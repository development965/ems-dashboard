import type { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import { ConflictError, ForbiddenError, NotFoundError } from "@/utils/AppError.js";
import type { AuthUser } from "@/types/express.js";
import { isCompanyWideRole } from "@/middleware/rbac.js";
import { EMS_SCOPE_START } from "@/config/scope.js";
import type {
  CreateRevenueShareInput,
  ReviewRevenueShareInput,
  RevenueShareFilters,
  SettleRevenueShareInput,
} from "@/modules/revenueShares/revenueShares.schema.js";

const includeForList = {
  payment: { select: { id: true, amount: true, paidAt: true, student: { select: { id: true, name: true } } } },
  fromBranch: { select: { id: true, name: true } },
  toBranch: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, name: true } },
  settledBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
};

type ShareRow = Prisma.PaymentRevenueShareGetPayload<{ include: typeof includeForList }>;

function serialize(row: ShareRow) {
  return {
    ...row,
    shareAmount: toMoney(row.shareAmount),
    splitPercent: row.splitPercent === null ? null : Number(row.splitPercent),
    payment: { ...row.payment, amount: toMoney(row.payment.amount) },
  };
}

/** A branch-scoped user sees a share whichever side of it they're on (what they owe, and
 * what they're owed) — a company-wide role sees everything, optionally narrowed to one
 * branch's involvement (either side) via `requestedBranchId`. */
function resolveBranchFilter(user: AuthUser, requestedBranchId?: string) {
  if (isCompanyWideRole(user.role)) {
    return requestedBranchId ? { OR: [{ fromBranchId: requestedBranchId }, { toBranchId: requestedBranchId }] } : {};
  }
  return { OR: [{ fromBranchId: user.branchId ?? "" }, { toBranchId: user.branchId ?? "" }] };
}

/** Just id + name, for every branch in the company — a branch admin normally can't list
 * other branches at all (`GET /branches` is scoped to their own), but picking a service
 * branch to share collection with means seeing every branch's name, nothing more. */
export async function listBranchDirectory(user: AuthUser) {
  return prisma.branch.findMany({
    where: { companyId: user.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listRevenueShares(user: AuthUser, filters: RevenueShareFilters) {
  const branchFilter = resolveBranchFilter(user, filters.branchId);

  const rows = await prisma.paymentRevenueShare.findMany({
    where: {
      companyId: user.companyId,
      ...branchFilter,
      payment: { student: { createdAt: { gte: EMS_SCOPE_START } } },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
    },
    include: includeForList,
    orderBy: { createdAt: "desc" },
  });

  return rows.map(serialize);
}

/** Flag part of an already-collected payment as owed to another branch that actually
 * delivered the service. Only the collecting branch (or a company-wide role) can raise
 * this — you can't declare someone else's collection shared on their behalf. */
export async function createRevenueShare(user: AuthUser, input: CreateRevenueShareInput) {
  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, companyId: user.companyId },
    select: { id: true, amount: true, branchId: true, branch: { select: { name: true } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  if (!isCompanyWideRole(user.role) && payment.branchId !== user.branchId) {
    throw new ForbiddenError("Cannot share a payment collected by another branch");
  }
  if (input.toBranchId === payment.branchId) {
    throw new ConflictError("The service branch must be different from the branch that collected the payment");
  }

  const toBranch = await prisma.branch.findFirst({ where: { id: input.toBranchId, companyId: user.companyId } });
  if (!toBranch) throw new NotFoundError("Branch not found");

  const paymentAmount = toMoney(payment.amount);
  const shareAmount =
    input.splitPercent !== undefined ? Math.round(paymentAmount * (input.splitPercent / 100) * 100) / 100 : input.shareAmount!;

  // A payment can be split across more than one service branch, but never share out more
  // than was actually collected.
  const existing = await prisma.paymentRevenueShare.aggregate({
    where: { paymentId: payment.id },
    _sum: { shareAmount: true },
  });
  const alreadyShared = toMoney(existing._sum.shareAmount ?? 0);
  if (alreadyShared + shareAmount > paymentAmount + 0.01) {
    throw new ConflictError(
      `Only ₹${(paymentAmount - alreadyShared).toFixed(2)} of this ₹${paymentAmount.toFixed(2)} payment is still unshared`,
    );
  }

  const share = await prisma.paymentRevenueShare.create({
    data: {
      companyId: user.companyId,
      paymentId: payment.id,
      fromBranchId: payment.branchId,
      toBranchId: input.toBranchId,
      splitPercent: input.splitPercent,
      shareAmount,
      note: input.note,
      transferDate: input.transferDate ?? new Date(),
      recordedById: user.id,
    },
    include: includeForList,
  });

  await logAudit({
    actor: user,
    branchId: payment.branchId,
    action: "revenueShare.created",
    entityType: "PaymentRevenueShare",
    entityId: share.id,
    summary: `Flagged ₹${shareAmount} of a payment collected at ${payment.branch.name} as owed to ${toBranch.name}`,
  });

  return serialize(share);
}

/** Super-admin-only — the same "real money actually moved" gate used for petty cash
 * top-ups, since settling a share means one branch has actually paid another. */
export async function settleRevenueShare(user: AuthUser, shareId: string, input: SettleRevenueShareInput) {
  const share = await prisma.paymentRevenueShare.findFirst({
    where: { id: shareId, companyId: user.companyId },
    include: includeForList,
  });
  if (!share) throw new NotFoundError("Revenue share not found");
  if (share.status !== "PENDING") throw new ConflictError("This share has already been settled");

  const updated = await prisma.paymentRevenueShare.update({
    where: { id: share.id },
    data: { status: "SETTLED", settledById: user.id, settledAt: new Date(), settlementNote: input.settlementNote },
    include: includeForList,
  });

  await logAudit({
    actor: user,
    branchId: share.fromBranchId,
    action: "revenueShare.settled",
    entityType: "PaymentRevenueShare",
    entityId: share.id,
    summary: `Settled a ₹${toMoney(share.shareAmount)} revenue share from ${share.fromBranch.name} to ${share.toBranch.name}`,
  });

  return serialize(updated);
}

/** The "Transfers" tab's sign-off — only meaningful once a transfer is actually SETTLED
 * (money has moved), and only one confirmation is needed, from either a super admin or an
 * accountant, not both independently. Re-reviewable at any time (e.g. flipping a dispute
 * back to accepted once it's sorted out), each pass overwriting the last and audit-logged. */
export async function reviewRevenueShare(user: AuthUser, shareId: string, input: ReviewRevenueShareInput) {
  const share = await prisma.paymentRevenueShare.findFirst({
    where: { id: shareId, companyId: user.companyId },
    include: includeForList,
  });
  if (!share) throw new NotFoundError("Revenue share not found");
  if (share.status !== "SETTLED") throw new ConflictError("Only a settled transfer can be reviewed");

  const updated = await prisma.paymentRevenueShare.update({
    where: { id: share.id },
    data: {
      reviewStatus: input.decision,
      reviewedById: user.id,
      reviewedAt: new Date(),
      disputeNote: input.decision === "DISPUTED" ? input.note : null,
    },
    include: includeForList,
  });

  await logAudit({
    actor: user,
    branchId: share.fromBranchId,
    action: input.decision === "ACCEPTED" ? "revenueShare.reviewAccepted" : "revenueShare.reviewDisputed",
    entityType: "PaymentRevenueShare",
    entityId: share.id,
    summary:
      input.decision === "ACCEPTED"
        ? `Accepted a ₹${toMoney(share.shareAmount)} transfer from ${share.fromBranch.name} to ${share.toBranch.name}`
        : `Disputed a ₹${toMoney(share.shareAmount)} transfer from ${share.fromBranch.name} to ${share.toBranch.name}: ${input.note}`,
  });

  return serialize(updated);
}

/**
 * Raw settled-transfer rows for revenue reporting — every SETTLED share moved real money
 * from `fromBranchId` to `toBranchId`, so a branch's *true* collection is its own customer
 * payments plus what it received minus what it paid out. Callers bucket/aggregate this
 * however their report needs (a single net-per-branch map, or per-month buckets); this just
 * fetches the raw facts within an optional `transferDate` window — deliberately not
 * `settledAt`, which is pure record-keeping and never decides which month a transfer counts
 * toward. Unfiltered by company-wide vs. single-branch scope — a caller that's already
 * scoped to one branch's payments only ever looks up that one branch's entry in the
 * resulting map, so fetching company-wide here and letting the caller pick is simpler than
 * re-deriving branch scope twice.
 */
export async function listSettledTransfersForReports(
  companyId: string,
  dateRange?: { gte?: Date; lte?: Date },
): Promise<{ fromBranchId: string; toBranchId: string; shareAmount: number; transferDate: Date }[]> {
  const shares = await prisma.paymentRevenueShare.findMany({
    where: {
      companyId,
      status: "SETTLED",
      payment: { student: { createdAt: { gte: EMS_SCOPE_START } } },
      ...(dateRange ? { transferDate: dateRange } : {}),
    },
    select: { fromBranchId: true, toBranchId: true, shareAmount: true, transferDate: true },
  });
  return shares.map((s) => ({
    fromBranchId: s.fromBranchId,
    toBranchId: s.toBranchId,
    shareAmount: toMoney(s.shareAmount),
    transferDate: s.transferDate,
  }));
}

/** Collapses a list of settled transfers into one net adjustment per branch — negative for
 * the branch that paid out, positive for the branch that received. Company-wide, this always
 * sums to zero (money moved, none created or destroyed), which is exactly why an unscoped
 * "total revenue" figure is left alone and only per-branch figures get adjusted. */
export function netTransferAdjustmentByBranch(
  transfers: { fromBranchId: string; toBranchId: string; shareAmount: number }[],
): Map<string, number> {
  const adjustments = new Map<string, number>();
  for (const t of transfers) {
    adjustments.set(t.fromBranchId, (adjustments.get(t.fromBranchId) ?? 0) - t.shareAmount);
    adjustments.set(t.toBranchId, (adjustments.get(t.toBranchId) ?? 0) + t.shareAmount);
  }
  return adjustments;
}

/** Super-admin-only — same reasoning as deleting a payment or petty cash entry: reserved
 * for correcting a genuine data-entry mistake, not for routine use. */
export async function deleteRevenueShare(user: AuthUser, shareId: string) {
  const share = await prisma.paymentRevenueShare.findFirst({
    where: { id: shareId, companyId: user.companyId },
    include: includeForList,
  });
  if (!share) throw new NotFoundError("Revenue share not found");

  await prisma.paymentRevenueShare.delete({ where: { id: share.id } });

  await logAudit({
    actor: user,
    branchId: share.fromBranchId,
    action: "revenueShare.deleted",
    entityType: "PaymentRevenueShare",
    entityId: share.id,
    summary: `Deleted a ₹${toMoney(share.shareAmount)} revenue share record from ${share.fromBranch.name} to ${share.toBranch.name}`,
  });
}
