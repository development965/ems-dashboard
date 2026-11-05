import { prisma } from "@/config/prisma.js";
import { toMoney } from "@/utils/money.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, isCompanyWideRole } from "@/middleware/rbac.js";
import { listSettledTransfersForReports, netTransferAdjustmentByBranch } from "@/modules/revenueShares/revenueShares.service.js";
import { inScopeFilter, scopedCreatedAt, studentInScopeFilter } from "@/config/scope.js";
import type { ReportFilters } from "@/modules/reports/reports.schema.js";

function resolveBranchFilter(user: AuthUser, branchId?: string) {
  if (!isCompanyWideRole(user.role)) return branchScopeFilter(user);
  return branchId ? { branchId } : {};
}

/** The one branch a revenue figure is scoped to, if any — a company-wide role viewing "all
 * branches" has none (transfers net to zero there), but a branch admin's own view, or a
 * company-wide role drilling into one specific branch, always does. */
function resolveEffectiveSingleBranchId(user: AuthUser, branchId?: string): string | undefined {
  return isCompanyWideRole(user.role) ? branchId : (user.branchId ?? undefined);
}

/** Branch.id filter (not a branchId FK) — for querying the Branch table itself in the same scope. */
function resolveVisibleBranchIds(user: AuthUser, branchId?: string): string[] | undefined {
  if (isCompanyWideRole(user.role)) return branchId ? [branchId] : undefined;
  return [user.branchId!];
}

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

export async function getSummary(user: AuthUser, filters: ReportFilters) {
  const branchFilter = resolveBranchFilter(user, filters.branchId);
  const paidAtRange = dateRange(filters.from, filters.to);
  const enrolledAtRange = dateRange(filters.from, filters.to);

  const [
    revenueAgg,
    studentAgg,
    discountAgg,
    byBranchRevenue,
    byBranchStudents,
    byBranchDiscount,
    branches,
    byCourseStudents,
    courses,
    recentPayments,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(paidAtRange ? { paidAt: paidAtRange } : {}) },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.student.aggregate({
      where: { companyId: user.companyId, ...branchFilter, createdAt: scopedCreatedAt(enrolledAtRange) },
      _sum: { totalFee: true },
      _count: true,
    }),
    prisma.discount.aggregate({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(paidAtRange ? { paidAt: paidAtRange } : {}) },
      _sum: { amount: true },
    }),
    prisma.student.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, createdAt: scopedCreatedAt(enrolledAtRange) },
      _sum: { totalFee: true },
      _count: true,
    }),
    prisma.discount.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true } }),
    prisma.student.groupBy({
      by: ["courseId"],
      where: { companyId: user.companyId, ...branchFilter, createdAt: scopedCreatedAt(enrolledAtRange) },
      _sum: { totalFee: true },
      _count: true,
    }),
    prisma.course.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true, code: true } }),
    prisma.payment.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(paidAtRange ? { paidAt: paidAtRange } : {}) },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const revenueByBranchId = new Map(byBranchRevenue.map((r) => [r.branchId, toMoney(r._sum.amount ?? 0)]));
  const discountByBranchId = new Map(byBranchDiscount.map((d) => [d.branchId, toMoney(d._sum.amount ?? 0)]));

  // A branch's *true* collection includes what it received/paid out in settled inter-branch
  // transfers — but a student's outstanding balance never does, so outstanding is always
  // computed from the raw (unadjusted) collected-from-payments figure, never this one.
  const transfersInRange = await listSettledTransfersForReports(user.companyId, paidAtRange);
  const transferAdjustmentByBranch = netTransferAdjustmentByBranch(transfersInRange);

  const byBranch = byBranchStudents.map((row) => {
    // Net of discounts — the fee actually expected, not the pre-discount sticker price.
    const feesInvoiced = Math.max(toMoney(row._sum.totalFee ?? 0) - (discountByBranchId.get(row.branchId) ?? 0), 0);
    const rawRevenueCollected = revenueByBranchId.get(row.branchId) ?? 0;
    const revenueCollected = rawRevenueCollected + (transferAdjustmentByBranch.get(row.branchId) ?? 0);
    return {
      branchId: row.branchId,
      branchName: branchNameById.get(row.branchId) ?? "Unknown",
      students: row._count,
      feesInvoiced,
      revenueCollected,
      outstanding: Math.max(feesInvoiced - rawRevenueCollected, 0),
    };
  });

  const byCourse = byCourseStudents.map((row) => {
    const course = courseById.get(row.courseId);
    return {
      courseId: row.courseId,
      courseName: course?.name ?? "Unknown",
      courseCode: course?.code ?? "—",
      students: row._count,
      feesInvoiced: toMoney(row._sum.totalFee ?? 0),
    };
  });

  const feesInvoiced = Math.max(toMoney(studentAgg._sum.totalFee ?? 0) - toMoney(discountAgg._sum.amount ?? 0), 0);
  const rawRevenueCollected = toMoney(revenueAgg._sum.amount ?? 0);
  const effectiveSingleBranchId = resolveEffectiveSingleBranchId(user, filters.branchId);
  // Company-wide (no single branch in scope), transfers net to zero, so this is a no-op there.
  const revenueCollected = rawRevenueCollected + (effectiveSingleBranchId ? (transferAdjustmentByBranch.get(effectiveSingleBranchId) ?? 0) : 0);

  return {
    totals: {
      students: studentAgg._count,
      payments: revenueAgg._count,
      feesInvoiced,
      revenueCollected,
      outstanding: Math.max(feesInvoiced - rawRevenueCollected, 0),
    },
    byBranch: byBranch.sort((a, b) => b.revenueCollected - a.revenueCollected),
    byCourse: byCourse.sort((a, b) => b.students - a.students),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      studentId: p.student.id,
      studentName: p.student.name,
      amount: toMoney(p.amount),
      method: p.method,
      paidAt: p.paidAt,
    })),
  };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getFinanceDashboard(user: AuthUser, branchId?: string) {
  const branchFilter = resolveBranchFilter(user, branchId);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  // 11 full months back + the current month = a rolling 12-month window.
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [trendPayments, outstandingFeesAgg, outstandingDiscountAgg, outstandingPaidAgg, branches] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, paidAt: { gte: trendStart } },
      select: {
        amount: true,
        method: true,
        paidAt: true,
        branchId: true,
        student: { select: { courseId: true, course: { select: { name: true } } } },
      },
    }),
    prisma.student.aggregate({
      where: { companyId: user.companyId, ...branchFilter, ...inScopeFilter },
      _sum: { totalFee: true },
    }),
    prisma.discount.aggregate({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true } }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  // True collection for this trend = payments plus/minus settled transfers — but a branch's
  // outstanding balance (below) never includes transfers, same reasoning as getSummary.
  const effectiveBranchId = resolveEffectiveSingleBranchId(user, branchId);
  const trendTransfers = await listSettledTransfersForReports(user.companyId, { gte: trendStart });

  // Build the 12 chronological month buckets up front so empty months still appear (a flat
  // line/bar at zero, not a gap) — flat months are exactly what "no revenue that month" should show.
  const monthBuckets: { key: string; month: string; year: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), revenue: 0 });
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));

  const ytdPayments = trendPayments.filter((p) => p.paidAt >= yearStart);

  for (const payment of trendPayments) {
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.revenue += toMoney(payment.amount);
  }
  if (effectiveBranchId) {
    for (const t of trendTransfers) {
      const key = `${t.transferDate.getFullYear()}-${t.transferDate.getMonth()}`;
      const bucket = bucketByKey.get(key);
      if (!bucket) continue;
      if (t.toBranchId === effectiveBranchId) bucket.revenue += t.shareAmount;
      if (t.fromBranchId === effectiveBranchId) bucket.revenue -= t.shareAmount;
    }
  }

  const byMethodMap = new Map<string, number>();
  for (const payment of ytdPayments) {
    byMethodMap.set(payment.method, (byMethodMap.get(payment.method) ?? 0) + toMoney(payment.amount));
  }

  const byBranchMap = new Map<string, number>();
  for (const payment of ytdPayments) {
    byBranchMap.set(payment.branchId, (byBranchMap.get(payment.branchId) ?? 0) + toMoney(payment.amount));
  }

  const byCourseMap = new Map<string, { name: string; revenue: number }>();
  for (const payment of ytdPayments) {
    const courseId = payment.student.courseId;
    const existing = byCourseMap.get(courseId);
    const amount = toMoney(payment.amount);
    if (existing) existing.revenue += amount;
    else byCourseMap.set(courseId, { name: payment.student.course.name, revenue: amount });
  }

  const feesInvoiced = Math.max(
    toMoney(outstandingFeesAgg._sum.totalFee ?? 0) - toMoney(outstandingDiscountAgg._sum.amount ?? 0),
    0,
  );
  const revenueCollectedAllTime = toMoney(outstandingPaidAgg._sum.amount ?? 0);

  const ytdTransfers = trendTransfers.filter((t) => t.transferDate >= yearStart);
  const ytdTransferAdjustment = effectiveBranchId
    ? ytdTransfers.reduce(
        (sum, t) =>
          sum + (t.toBranchId === effectiveBranchId ? t.shareAmount : 0) - (t.fromBranchId === effectiveBranchId ? t.shareAmount : 0),
        0,
      )
    : 0;
  const byBranchTransferAdjustment = netTransferAdjustmentByBranch(ytdTransfers);

  return {
    ytd: {
      year: now.getFullYear(),
      revenue: ytdPayments.reduce((sum, p) => sum + toMoney(p.amount), 0) + ytdTransferAdjustment,
      paymentsCount: ytdPayments.length,
    },
    // Outstanding is what a branch's own students still owe — unaffected by how branches
    // split money between themselves after the fact, so this stays on the raw figure.
    outstanding: Math.max(feesInvoiced - revenueCollectedAllTime, 0),
    monthlyTrend: monthBuckets,
    byMethod: [...byMethodMap.entries()]
      .map(([method, revenue]) => ({ method, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    byBranch: [...byBranchMap.entries()]
      .map(([id, revenue]) => ({
        branchId: id,
        branchName: branchNameById.get(id) ?? "Unknown",
        revenue: revenue + (byBranchTransferAdjustment.get(id) ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue),
    byCourse: [...byCourseMap.entries()]
      .map(([courseId, { name, revenue }]) => ({ courseId, courseName: name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
  };
}

/**
 * The "Revenue Console" widget set — same shape as the standalone consolidated-revenue
 * dashboard the branches used before this system existed (monthly-by-branch trend,
 * branch share, YTD cumulative, payment-channel split, branch×month matrix, YTD table,
 * top courses), rebuilt here against our own data instead of scraped receipt exports.
 */
export async function getRevenueConsole(user: AuthUser) {
  const branchFilter = resolveBranchFilter(user);

  const now = new Date();
  // "YTD" here mirrors the standalone Consol Revenue dashboard's own default behaviour: when
  // loaded with a full historical pull (which is always, since there's no upload step anymore),
  // its YTD-start/YTD-end pickers default to the earliest and latest month present in the data —
  // i.e. "year to date" ends up meaning "since the beginning", not "since Jan 1". We match that
  // exactly rather than a literal calendar-year window, so the numbers agree with that dashboard.
  const earliestPayment = await prisma.payment.aggregate({
    where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
    _min: { paidAt: true },
  });
  const yearStart = earliestPayment._min.paidAt
    ? new Date(earliestPayment._min.paidAt.getFullYear(), earliestPayment._min.paidAt.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);
  const trendStart = yearStart;

  const [trendPayments, ytdDiscounts, branches] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, paidAt: { gte: trendStart } },
      select: {
        amount: true,
        method: true,
        paidAt: true,
        branchId: true,
        student: { select: { courseId: true, course: { select: { name: true } } } },
      },
    }),
    prisma.discount.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, createdAt: { gte: yearStart } },
      select: { amount: true, branchId: true, student: { select: { courseId: true } } },
    }),
    prisma.branch.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const ytdPayments = trendPayments.filter((p) => p.paidAt >= yearStart);
  const branchIdsWithActivity = [...new Set(ytdPayments.map((p) => p.branchId))];
  const activeBranches = branches.filter((b) => branchIdsWithActivity.includes(b.id));

  // Monthly-by-branch buckets, from the earliest payment's month through the current month —
  // feeds both the stacked bar chart and the matrix.
  const monthCount =
    (now.getFullYear() - trendStart.getFullYear()) * 12 + (now.getMonth() - trendStart.getMonth()) + 1;
  const monthBuckets: { key: string; month: string; year: number; byBranch: Record<string, number>; total: number }[] = [];
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(trendStart.getFullYear(), trendStart.getMonth() + i, 1);
    monthBuckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      byBranch: {},
      total: 0,
    });
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const payment of trendPayments) {
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    const bucket = bucketByKey.get(key);
    if (!bucket) continue;
    const amount = toMoney(payment.amount);
    bucket.byBranch[payment.branchId] = (bucket.byBranch[payment.branchId] ?? 0) + amount;
    bucket.total += amount;
  }

  // monthBuckets already spans exactly the YTD range (trendStart === yearStart), so every
  // bucket feeds the cumulative line chart — no separate filtering needed.
  const cumulativeByBranch: Record<string, number> = {};
  let cumulativeTotal = 0;
  const ytdCumulative = monthBuckets.map((bucket) => {
    const byBranch: Record<string, number> = {};
    for (const branch of activeBranches) {
      cumulativeByBranch[branch.id] = (cumulativeByBranch[branch.id] ?? 0) + (bucket.byBranch[branch.id] ?? 0);
      byBranch[branch.id] = cumulativeByBranch[branch.id];
    }
    cumulativeTotal += bucket.total;
    return { month: bucket.month, year: bucket.year, byBranch, total: cumulativeTotal };
  });

  const byMethodMap = new Map<string, number>();
  for (const payment of ytdPayments) {
    byMethodMap.set(payment.method, (byMethodMap.get(payment.method) ?? 0) + toMoney(payment.amount));
  }

  const discountByBranch = new Map<string, number>();
  const discountByCourse = new Map<string, number>();
  for (const discount of ytdDiscounts) {
    const amount = toMoney(discount.amount);
    discountByBranch.set(discount.branchId, (discountByBranch.get(discount.branchId) ?? 0) + amount);
    discountByCourse.set(discount.student.courseId, (discountByCourse.get(discount.student.courseId) ?? 0) + amount);
  }

  const revenueByBranch = new Map<string, number>();
  const paymentsByBranch = new Map<string, number>();
  const revenueByCourse = new Map<string, { name: string; revenue: number; payments: number }>();
  for (const payment of ytdPayments) {
    const amount = toMoney(payment.amount);
    revenueByBranch.set(payment.branchId, (revenueByBranch.get(payment.branchId) ?? 0) + amount);
    paymentsByBranch.set(payment.branchId, (paymentsByBranch.get(payment.branchId) ?? 0) + 1);

    const courseId = payment.student.courseId;
    const existing = revenueByCourse.get(courseId);
    if (existing) {
      existing.revenue += amount;
      existing.payments += 1;
    } else {
      revenueByCourse.set(courseId, { name: payment.student.course.name, revenue: amount, payments: 1 });
    }
  }

  const ytdRevenueTotal = ytdPayments.reduce((sum, p) => sum + toMoney(p.amount), 0);
  const ytdDiscountTotal = ytdDiscounts.reduce((sum, d) => sum + toMoney(d.amount), 0);

  const firstBucket = monthBuckets[0];
  const lastBucket = monthBuckets[monthBuckets.length - 1];

  return {
    ytd: {
      year: now.getFullYear(),
      startLabel: firstBucket ? `${firstBucket.month} ${firstBucket.year}` : "",
      endLabel: lastBucket ? `${lastBucket.month} ${lastBucket.year}` : "",
      revenue: ytdRevenueTotal,
      paymentsCount: ytdPayments.length,
      avgPerPayment: ytdPayments.length ? ytdRevenueTotal / ytdPayments.length : 0,
      discountsGiven: ytdDiscountTotal,
      discountPctOfBilled: ytdRevenueTotal + ytdDiscountTotal > 0 ? (100 * ytdDiscountTotal) / (ytdRevenueTotal + ytdDiscountTotal) : 0,
    },
    branches: activeBranches.map((b) => ({ id: b.id, name: b.name })),
    monthlyByBranch: monthBuckets.map((b) => ({ month: b.month, year: b.year, byBranch: b.byBranch, total: b.total })),
    ytdCumulativeByBranch: ytdCumulative,
    branchShare: [...revenueByBranch.entries()]
      .map(([id, revenue]) => ({ branchId: id, branchName: branchNameById.get(id) ?? "Unknown", revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    byMethod: [...byMethodMap.entries()]
      .map(([method, revenue]) => ({ method, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    ytdTableByBranch: [...revenueByBranch.entries()]
      .map(([id, revenue]) => ({
        branchId: id,
        branchName: branchNameById.get(id) ?? "Unknown",
        payments: paymentsByBranch.get(id) ?? 0,
        discount: discountByBranch.get(id) ?? 0,
        revenue,
        sharePct: ytdRevenueTotal > 0 ? (100 * revenue) / ytdRevenueTotal : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    topCourses: [...revenueByCourse.entries()]
      .map(([courseId, { name, revenue, payments }]) => ({
        courseId,
        courseName: name,
        payments,
        discount: discountByCourse.get(courseId) ?? 0,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15),
  };
}

/** Revenue for a date range (defaults to the current calendar month when none given), broken
 * down by branch, alongside each branch's current (all-time, not period-scoped) outstanding
 * balance — sorting is left to the client. */
export async function getRevenueReport(user: AuthUser, from: Date | undefined, to: Date | undefined, branchId?: string) {
  const branchFilter = resolveBranchFilter(user, branchId);
  const visibleBranchIds = resolveVisibleBranchIds(user, branchId);

  let periodFrom = from;
  let periodTo = to;
  if (!periodFrom && !periodTo) {
    const now = new Date();
    periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  const periodRange = dateRange(periodFrom, periodTo);

  const [periodRevenue, allTimeFees, allTimeDiscount, allTimePaid, branches] = await Promise.all([
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(periodRange ? { paidAt: periodRange } : {}) },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.student.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...inScopeFilter },
      _sum: { totalFee: true },
    }),
    prisma.discount.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter },
      _sum: { amount: true },
    }),
    prisma.branch.findMany({
      where: { companyId: user.companyId, ...(visibleBranchIds ? { id: { in: visibleBranchIds } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Settled within the same period as the payments above — a branch's revenue for the period
  // is its own collections plus/minus what it received/paid out via transfers in that window.
  // Outstanding stays on the raw, all-time paid figure (student debt, not branch cash-splitting).
  const periodTransfers = await listSettledTransfersForReports(user.companyId, periodRange);
  const periodTransferAdjustment = netTransferAdjustmentByBranch(periodTransfers);

  const periodRevenueByBranch = new Map(periodRevenue.map((r) => [r.branchId, { revenue: toMoney(r._sum.amount ?? 0), payments: r._count }]));
  const feesByBranch = new Map(allTimeFees.map((r) => [r.branchId, toMoney(r._sum.totalFee ?? 0)]));
  const discountByBranch = new Map(allTimeDiscount.map((r) => [r.branchId, toMoney(r._sum.amount ?? 0)]));
  const paidByBranch = new Map(allTimePaid.map((r) => [r.branchId, toMoney(r._sum.amount ?? 0)]));

  const rows = branches.map((b) => {
    const netFee = Math.max((feesByBranch.get(b.id) ?? 0) - (discountByBranch.get(b.id) ?? 0), 0);
    const outstanding = Math.max(netFee - (paidByBranch.get(b.id) ?? 0), 0);
    const period = periodRevenueByBranch.get(b.id);
    return {
      branchId: b.id,
      branchName: b.name,
      revenue: (period?.revenue ?? 0) + (periodTransferAdjustment.get(b.id) ?? 0),
      payments: period?.payments ?? 0,
      outstanding,
    };
  });

  return {
    from: periodFrom!.toISOString(),
    to: periodTo!.toISOString(),
    branches: rows.sort((a, b) => b.revenue - a.revenue),
    totals: {
      revenue: rows.reduce((sum, r) => sum + r.revenue, 0),
      payments: rows.reduce((sum, r) => sum + r.payments, 0),
      outstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
    },
  };
}

/**
 * Receipt-level drill-down behind the Revenue report — every individual payment in scope
 * (branch + date range), newest first, so "who paid how much" for a given branch/month is a
 * single click away from the aggregated revenue table.
 */
export async function getReceiptsReport(user: AuthUser, branchId?: string, from?: Date, to?: Date) {
  const branchFilter = resolveBranchFilter(user, branchId);
  const visibleBranchIds = resolveVisibleBranchIds(user, branchId);
  const paidAtRange = dateRange(from, to);
  const createdAtRange = dateRange(from, to);

  const [payments, discounts, transfers] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(paidAtRange ? { paidAt: paidAtRange } : {}) },
      include: {
        student: { select: { id: true, name: true, phone: true, course: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.discount.findMany({
      where: { companyId: user.companyId, ...branchFilter, ...studentInScopeFilter, ...(createdAtRange ? { createdAt: createdAtRange } : {}) },
      include: {
        student: { select: { id: true, name: true, course: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Settled transfers in the same window — these are real money in/out of a branch too, so
    // the branch's "true collection" (and every widget built on these rows, e.g. the Revenue
    // Console) needs them alongside customer payments, not off in a separate report.
    prisma.paymentRevenueShare.findMany({
      where: {
        companyId: user.companyId,
        status: "SETTLED",
        payment: studentInScopeFilter,
        ...(paidAtRange ? { transferDate: paidAtRange } : {}),
      },
      include: {
        payment: {
          select: { student: { select: { id: true, name: true, phone: true, course: { select: { id: true, name: true } } } } },
        },
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        settledBy: { select: { name: true } },
      },
      orderBy: { transferDate: "desc" },
    }),
  ]);

  const rows: {
    paymentId: string;
    paidAt: Date;
    studentId: string;
    studentName: string;
    studentPhone: string;
    branchId: string;
    branchName: string;
    courseName: string;
    amount: number;
    method: string;
    recordedByName: string;
    notes: string | null;
  }[] = payments.map((p) => ({
    paymentId: p.id,
    paidAt: p.paidAt,
    studentId: p.student.id,
    studentName: p.student.name,
    studentPhone: p.student.phone,
    branchId: p.branch.id,
    branchName: p.branch.name,
    courseName: p.student.course.name,
    amount: toMoney(p.amount),
    method: p.method,
    recordedByName: p.recordedBy.name,
    notes: p.notes,
  }));

  // Each settled transfer becomes up to two rows — a debit for the branch that paid it out,
  // a credit for the branch that received it — filtered to whichever branch(es) are actually
  // in scope, the same way the payment rows above already are.
  const allowedBranchIds = visibleBranchIds ? new Set(visibleBranchIds) : null;
  for (const t of transfers) {
    const amount = toMoney(t.shareAmount);
    const student = t.payment.student;
    if (!allowedBranchIds || allowedBranchIds.has(t.fromBranchId)) {
      rows.push({
        paymentId: `${t.id}-out`,
        paidAt: t.transferDate,
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.phone,
        branchId: t.fromBranch.id,
        branchName: t.fromBranch.name,
        courseName: student.course.name,
        amount: -amount,
        method: "TRANSFER_OUT",
        recordedByName: t.settledBy?.name ?? "—",
        notes: `Transfer to ${t.toBranch.name}`,
      });
    }
    if (!allowedBranchIds || allowedBranchIds.has(t.toBranchId)) {
      rows.push({
        paymentId: `${t.id}-in`,
        paidAt: t.transferDate,
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.phone,
        branchId: t.toBranch.id,
        branchName: t.toBranch.name,
        courseName: student.course.name,
        amount,
        method: "TRANSFER_IN",
        recordedByName: t.settledBy?.name ?? "—",
        notes: `Transfer from ${t.fromBranch.name}`,
      });
    }
  }
  rows.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

  // Discounts aren't tied to a specific payment in our schema (they're their own ledger entry),
  // so they're returned as a parallel array rather than merged into `rows` — same event shape
  // (branch/course/date/amount) for whoever wants to fold them into a combined view client-side.
  const discountRows = discounts.map((d) => ({
    discountId: d.id,
    createdAt: d.createdAt,
    studentId: d.student.id,
    studentName: d.student.name,
    branchId: d.branch.id,
    branchName: d.branch.name,
    courseName: d.student.course.name,
    amount: toMoney(d.amount),
    reason: d.reason,
  }));

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    rows,
    discountRows,
    totals: {
      // Company-wide (no branch in scope) this is unaffected — transfers net to zero — but
      // for one branch in scope it's genuinely "customer revenue + net transfers", the true
      // collection figure.
      revenue: rows.reduce((sum, r) => sum + r.amount, 0),
      receipts: payments.length,
      discounts: discountRows.reduce((sum, d) => sum + d.amount, 0),
    },
  };
}

/**
 * Student headcounts by branch/course/mode, plus a 12-month enrollment trend (always trailing
 * 12 months, independent of the date filter). When `from`/`to` are given, totals/breakdowns
 * cover only students enrolled in that range rather than the current all-time snapshot.
 */
export async function getStudentReport(user: AuthUser, branchId?: string, from?: Date, to?: Date) {
  const branchFilter = resolveBranchFilter(user, branchId);
  const visibleBranchIds = resolveVisibleBranchIds(user, branchId);
  const enrolledAtRange = dateRange(from, to);

  const now = new Date();
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [allStudents, branches, courses, trendStudents] = await Promise.all([
    prisma.student.findMany({
      where: {
        companyId: user.companyId,
        ...branchFilter,
        createdAt: scopedCreatedAt(enrolledAtRange),
      },
      select: { branchId: true, courseId: true, mode: true, status: true },
    }),
    prisma.branch.findMany({
      where: { companyId: user.companyId, ...(visibleBranchIds ? { id: { in: visibleBranchIds } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true } }),
    prisma.student.findMany({
      where: { companyId: user.companyId, ...branchFilter, createdAt: scopedCreatedAt({ gte: trendStart }) },
      select: { createdAt: true },
    }),
  ]);

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  const byBranch = branches.map((b) => {
    const rows = allStudents.filter((s) => s.branchId === b.id);
    return {
      branchId: b.id,
      branchName: b.name,
      total: rows.length,
      enrolled: rows.filter((s) => s.status === "ENROLLED").length,
      completed: rows.filter((s) => s.status === "COMPLETED").length,
      dropped: rows.filter((s) => s.status === "DROPPED").length,
    };
  });

  const byCourseMap = new Map<string, number>();
  for (const s of allStudents) byCourseMap.set(s.courseId, (byCourseMap.get(s.courseId) ?? 0) + 1);

  const byModeMap = new Map<string, number>();
  for (const s of allStudents) byModeMap.set(s.mode, (byModeMap.get(s.mode) ?? 0) + 1);

  const monthBuckets: { key: string; month: string; year: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), count: 0 });
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const s of trendStudents) {
    const key = `${s.createdAt.getFullYear()}-${s.createdAt.getMonth()}`;
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.count += 1;
  }

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totals: {
      total: allStudents.length,
      enrolled: allStudents.filter((s) => s.status === "ENROLLED").length,
      completed: allStudents.filter((s) => s.status === "COMPLETED").length,
      dropped: allStudents.filter((s) => s.status === "DROPPED").length,
    },
    byBranch: byBranch.sort((a, b) => b.total - a.total),
    byCourse: [...byCourseMap.entries()]
      .map(([courseId, total]) => ({ courseId, courseName: courseNameById.get(courseId) ?? "Unknown", total }))
      .sort((a, b) => b.total - a.total),
    byMode: [...byModeMap.entries()].map(([mode, total]) => ({ mode, total })),
    monthlyEnrollments: monthBuckets.map((b) => ({ month: b.month, year: b.year, count: b.count })),
  };
}

/**
 * Students who still owe money — a collections follow-up list, sorted by balance due descending.
 * `from`/`to`, when given, narrow this to students enrolled in that range (still evaluated
 * against their *current* balance, not a period-scoped one — dues aren't a period concept).
 */
export async function getOutstandingReport(user: AuthUser, branchId?: string, from?: Date, to?: Date) {
  const branchFilter = resolveBranchFilter(user, branchId);
  const enrolledAtRange = dateRange(from, to);

  const students = await prisma.student.findMany({
    where: {
      companyId: user.companyId,
      ...branchFilter,
      status: { not: "DROPPED" },
      createdAt: scopedCreatedAt(enrolledAtRange),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      totalFee: true,
      branch: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
      discounts: { select: { amount: true } },
      createdAt: true,
    },
  });

  const rows = students
    .map((s) => {
      const paid = s.payments.reduce((sum, p) => sum + toMoney(p.amount), 0);
      const discount = s.discounts.reduce((sum, d) => sum + toMoney(d.amount), 0);
      const netFee = Math.max(toMoney(s.totalFee) - discount, 0);
      const balanceDue = Math.max(netFee - paid, 0);
      return {
        studentId: s.id,
        studentName: s.name,
        phone: s.phone,
        branchId: s.branch.id,
        branchName: s.branch.name,
        courseName: s.course.name,
        netFee,
        paid,
        balanceDue,
        enrolledAt: s.createdAt,
      };
    })
    .filter((r) => r.balanceDue > 0)
    .sort((a, b) => b.balanceDue - a.balanceDue);

  return {
    students: rows,
    totalOutstanding: rows.reduce((sum, r) => sum + r.balanceDue, 0),
    studentsWithDues: rows.length,
  };
}

/** Certification/placement outcomes — only counts students who've actually completed (or dropped isn't relevant here). */
export async function getPlacementReport(user: AuthUser, branchId?: string, from?: Date, to?: Date) {
  const branchFilter = resolveBranchFilter(user, branchId);
  const enrolledAtRange = dateRange(from, to);

  const students = await prisma.student.findMany({
    where: {
      companyId: user.companyId,
      ...branchFilter,
      status: { not: "DROPPED" },
      createdAt: scopedCreatedAt(enrolledAtRange),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      branch: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      certificationStatus: true,
      certificateNo: true,
      certificateIssuedAt: true,
      placementStatus: true,
      placementCompany: true,
      placementRole: true,
      placementPackageLPA: true,
      placedAt: true,
    },
  });

  const rows = students.map((s) => ({
    studentId: s.id,
    studentName: s.name,
    phone: s.phone,
    branchId: s.branch.id,
    branchName: s.branch.name,
    courseName: s.course.name,
    certificationStatus: s.certificationStatus,
    certificateNo: s.certificateNo,
    certificateIssuedAt: s.certificateIssuedAt,
    placementStatus: s.placementStatus,
    placementCompany: s.placementCompany,
    placementRole: s.placementRole,
    placementPackageLPA: s.placementPackageLPA === null ? null : toMoney(s.placementPackageLPA),
    placedAt: s.placedAt,
  }));

  const totals = {
    students: rows.length,
    certified: rows.filter((r) => r.certificationStatus === "ISSUED").length,
    placed: rows.filter((r) => r.placementStatus === "PLACED").length,
    placementInProgress: rows.filter((r) => r.placementStatus === "IN_PROGRESS").length,
  };

  const byBranchMap = new Map<string, { branchId: string; branchName: string; students: number; certified: number; placed: number }>();
  for (const r of rows) {
    const entry = byBranchMap.get(r.branchId) ?? { branchId: r.branchId, branchName: r.branchName, students: 0, certified: 0, placed: 0 };
    entry.students += 1;
    if (r.certificationStatus === "ISSUED") entry.certified += 1;
    if (r.placementStatus === "PLACED") entry.placed += 1;
    byBranchMap.set(r.branchId, entry);
  }

  return {
    students: rows,
    totals,
    byBranch: Array.from(byBranchMap.values()).sort((a, b) => b.students - a.students),
  };
}
