import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { fetchBranches } from "@/lib/branchesApi";
import { fetchFinanceDashboard, fetchReportSummary } from "@/lib/reportsApi";
import { fetchTargets } from "@/lib/targetsApi";
import { fetchLeadFunnel } from "@/lib/leadsApi";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { TrendColumnChart } from "@/components/charts/TrendColumnChart";
import { RevenueConsoleReplica } from "@/components/RevenueConsoleReplica";
import { Spinner } from "@/components/Spinner";
import type { LeadFunnel } from "@/types/lead";
import type { Zone } from "@/types/branch";

const ZONE_TABS: { value: Zone | ""; label: string }[] = [
  { value: "", label: "All zones" },
  { value: "ZONE_1", label: "Zone 1" },
  { value: "ZONE_2", label: "Zone 2" },
  { value: "ZONE_3", label: "Zone 3" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentMonthInfo() {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  // Leads are a branch's/super admin's job, not an accountant's — same rule as the sidebar nav.
  const showLeads = user?.role !== "ACCOUNTANT";
  const { from, to, year, month } = currentMonthInfo();

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: seesAllBranches });
  const summaryQuery = useQuery({ queryKey: ["reports-summary", ""], queryFn: () => fetchReportSummary() });
  const monthSummaryQuery = useQuery({
    queryKey: ["reports-summary-month", from, to],
    queryFn: () => fetchReportSummary(undefined, from, to),
    enabled: !seesAllBranches,
  });
  const targetQuery = useQuery({
    queryKey: ["my-branch-target", year, month],
    queryFn: () => fetchTargets(year, month),
    enabled: !seesAllBranches,
  });
  const leadFunnelQuery = useQuery({ queryKey: ["lead-funnel", ""], queryFn: () => fetchLeadFunnel(), enabled: showLeads });
  // The Revenue Console's Outstanding KPI deliberately excludes everything before this cutoff —
  // older/legacy-migrated balances aren't counted, only students enrolled and payments made
  // from March 2026 onward.
  const marchOutstandingQuery = useQuery({
    queryKey: ["reports-summary-outstanding-march2026"],
    queryFn: () => fetchReportSummary(undefined, "2026-03-01", undefined),
    enabled: seesAllBranches,
  });
  const trendQuery = useQuery({
    queryKey: ["finance-dashboard-trend", ""],
    queryFn: () => fetchFinanceDashboard(),
    enabled: !seesAllBranches,
  });
  const [zone, setZone] = useState<Zone | "">("");

  const zoneBranchIds = useMemo(() => {
    if (!zone) return null;
    return new Set((branchesQuery.data ?? []).filter((b) => b.zone === zone).map((b) => b.id));
  }, [branchesQuery.data, zone]);

  const zoneBranchCount = zoneBranchIds ? zoneBranchIds.size : (branchesQuery.data?.length ?? undefined);

  // Company-wide totals are already broken down per branch in the summary response, so a
  // zone is just a client-side sum over the rows whose branch falls in it — no separate
  // zone-aware endpoint needed.
  const zoneTotals = useMemo(() => {
    const byBranch = summaryQuery.data?.byBranch;
    if (!byBranch) return undefined;
    const rows = zoneBranchIds ? byBranch.filter((r) => zoneBranchIds.has(r.branchId)) : byBranch;
    return {
      students: rows.reduce((sum, r) => sum + r.students, 0),
      revenueCollected: rows.reduce((sum, r) => sum + r.revenueCollected, 0),
      outstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
    };
  }, [summaryQuery.data, zoneBranchIds]);

  // March-2026-onward byBranch rows, zone-scoped, reshaped for the Revenue Console's
  // Outstanding KPI — see marchOutstandingQuery above for why it's a separate fetch.
  const outstandingByBranch = useMemo(() => {
    const byBranch = marchOutstandingQuery.data?.byBranch;
    if (!byBranch) return undefined;
    const rows = zoneBranchIds ? byBranch.filter((r) => zoneBranchIds.has(r.branchId)) : byBranch;
    return rows.map((r) => ({ branchId: r.branchId, outstanding: r.outstanding }));
  }, [marchOutstandingQuery.data, zoneBranchIds]);

  const totals = seesAllBranches ? zoneTotals : summaryQuery.data?.totals;
  const monthTotals = monthSummaryQuery.data?.totals;
  const myTarget = targetQuery.data?.branches[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {seesAllBranches ? "Company-wide overview across all branches." : "Overview for your branch."}
        </p>
      </div>

      {seesAllBranches && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {ZONE_TABS.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              onClick={() => setZone(t.value)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                zone === t.value ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!seesAllBranches && <TargetHighlight monthLabel={`${MONTH_NAMES[month - 1]} ${year}`} target={myTarget} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {seesAllBranches && <StatTile label="Total branches" value={zoneBranchCount ?? "—"} />}
        <StatTile label="Students" value={totals?.students ?? "—"} />
        {seesAllBranches ? (
          <StatTile label="Revenue collected" value={totals ? formatINR(totals.revenueCollected) : "—"} tone="positive" />
        ) : (
          <>
            <StatTile label="New students (this month)" value={monthTotals?.students ?? "—"} />
            <StatTile label="Revenue collected (this month)" value={monthTotals ? formatINR(monthTotals.revenueCollected) : "—"} tone="positive" />
          </>
        )}
        <StatTile label="Outstanding fees" value={totals ? formatINR(totals.outstanding) : "—"} tone="negative" />
      </div>

      <div className={`grid grid-cols-1 gap-6 ${showLeads && !seesAllBranches ? "lg:grid-cols-2" : ""}`}>
        {showLeads && <LeadFunnelWidget funnel={leadFunnelQuery.data} />}
        {!seesAllBranches && <RevenueTrendWidget monthlyTrend={trendQuery.data?.monthlyTrend} />}
      </div>

      {seesAllBranches && (
        <RevenueConsoleReplica branchIds={zoneBranchIds ? [...zoneBranchIds] : undefined} outstandingByBranch={outstandingByBranch} />
      )}

      <p className="text-sm text-slate-500">
        See the full breakdown on the{" "}
        <Link to="/reports" className="font-medium text-brand-600 hover:underline">
          Reports
        </Link>{" "}
        page.
      </p>
    </div>
  );
}

/** Always shown for a branch admin — the monthly target a super admin set for their branch is
 * a number they're accountable for, so it can't be tucked away or skipped when unset. */
function TargetHighlight({
  monthLabel,
  target,
}: {
  monthLabel: string;
  target: { targetAmount: number | null; actual: number; achievedPct: number | null } | undefined;
}) {
  if (!target) {
    return (
      <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    );
  }

  if (target.targetAmount === null) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-600">No target set for {monthLabel} yet</p>
        <p className="text-xs text-slate-400">Ask a super admin to set one under Targets.</p>
      </div>
    );
  }

  const pct = target.achievedPct ?? 0;
  const tone = pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-brand-700">{monthLabel} target</p>
        <p className="text-xs font-medium text-slate-500">
          {formatINR(target.actual)} of {formatINR(target.targetAmount)}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="w-14 shrink-0 text-right text-lg font-bold text-slate-900">{pct}%</span>
      </div>
    </div>
  );
}

/** Company-wide for a super admin, own-branch-only for a branch admin (already scoped
 * server-side) — accountants don't get this at all, they don't manage leads. */
function LeadFunnelWidget({ funnel }: { funnel: LeadFunnel | undefined }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Leads</h2>
        <Link to="/leads" className="text-sm font-medium text-brand-600 hover:underline">
          View all →
        </Link>
      </div>
      {funnel ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Open" value={funnel.open} />
          <MiniStat label="Converted" value={funnel.converted} tone="positive" />
          <MiniStat label="Lost" value={funnel.lost} tone="negative" />
          <MiniStat label="Conversion" value={funnel.conversionRatePct !== null ? `${funnel.conversionRatePct}%` : "—"} />
        </div>
      ) : (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-slate-900";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

/** Only shown for a branch admin — super admins/accountants already get this (in more depth,
 * with branch/course breakdowns) via the Revenue Console below. */
function RevenueTrendWidget({ monthlyTrend }: { monthlyTrend: { month: string; year: number; revenue: number }[] | undefined }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Revenue trend — trailing 12 months</h2>
      {monthlyTrend ? (
        <TrendColumnChart data={monthlyTrend} />
      ) : (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
    </section>
  );
}

