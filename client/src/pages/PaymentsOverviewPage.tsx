import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFinanceDashboard } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { TrendColumnChart } from "@/components/charts/TrendColumnChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";

const METHOD_LABELS: Record<string, string> = {
  RAZORPAY_LINK: "Razorpay link",
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

const METHOD_COLORS: Record<string, string> = {
  RAZORPAY_LINK: "--viz-series-1",
  CASH: "--viz-series-2",
  BANK_TRANSFER: "--viz-series-3",
  OTHER: "--viz-series-4",
};

export function PaymentsOverviewPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const dashboardQuery = useQuery({
    queryKey: ["finance-dashboard", branchId],
    queryFn: () => fetchFinanceDashboard(branchId || undefined),
  });

  const dashboard = dashboardQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue overview</h1>
          <p className="text-sm text-slate-500">
            {dashboard ? `Year-to-date ${dashboard.ytd.year}` : "Loading"} · {isSuperAdmin ? "all branches" : "your branch"}
          </p>
        </div>
        {isSuperAdmin && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">All branches</option>
              {branchesQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={`YTD revenue (${dashboard?.ytd.year ?? ""})`} value={dashboard ? formatINR(dashboard.ytd.revenue) : "—"} tone="positive" />
        <StatTile label="YTD payments" value={dashboard?.ytd.paymentsCount ?? "—"} />
        <StatTile label="Outstanding (all-time)" value={dashboard ? formatINR(dashboard.outstanding) : "—"} tone="negative" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Monthly revenue — trailing 12 months</h2>
        {dashboard && <TrendColumnChart data={dashboard.monthlyTrend} />}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Revenue by payment channel (YTD)</h2>
          {dashboard && (
            <DonutChart
              data={dashboard.byMethod.map((m) => ({
                label: METHOD_LABELS[m.method] ?? m.method,
                value: m.revenue,
                colorVar: METHOD_COLORS[m.method] ?? "--viz-series-8",
              }))}
            />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Top courses by revenue (YTD)</h2>
          {dashboard && (
            <HorizontalBarChart data={dashboard.byCourse.map((c) => ({ label: c.courseName, value: c.revenue }))} />
          )}
        </section>
      </div>

      {isSuperAdmin && !branchId && dashboard && dashboard.byBranch.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Revenue by branch (YTD)</h2>
          <HorizontalBarChart
            data={dashboard.byBranch.map((b) => ({ label: b.branchName, value: b.revenue }))}
            colorVar="--viz-series-1"
          />
        </section>
      )}
    </div>
  );
}
