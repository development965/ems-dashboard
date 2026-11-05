import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportSummary } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const summaryQuery = useQuery({
    queryKey: ["reports-summary", branchId, from, to],
    queryFn: () => fetchReportSummary(branchId || undefined, from || undefined, to || undefined),
  });

  const totals = summaryQuery.data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-500">
          Revenue and enrollment overview {isSuperAdmin ? "across the company" : "for your branch"}
          {from || to ? "" : " (all time)"}.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={totals?.students ?? "—"} />
        <StatCard label="Fees invoiced" value={totals ? formatINR(totals.feesInvoiced) : "—"} />
        <StatCard label="Revenue collected" value={totals ? formatINR(totals.revenueCollected) : "—"} tone="positive" />
        <StatCard label="Outstanding" value={totals ? formatINR(totals.outstanding) : "—"} tone="negative" />
      </div>

      {isSuperAdmin && !branchId && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">By branch</h2>
            <ExportCsvButton
              filename="revenue-by-branch"
              headers={["Branch", "Students", "Invoiced", "Collected", "Outstanding"]}
              rows={(summaryQuery.data?.byBranch ?? []).map((r) => [
                r.branchName,
                r.students,
                r.feesInvoiced,
                r.revenueCollected,
                r.outstanding,
              ])}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Invoiced</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryQuery.isLoading && <TableLoadingRow colSpan={5} />}
                {summaryQuery.data?.byBranch.map((row) => (
                  <tr key={row.branchId}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.branchName}</td>
                    <td className="px-4 py-3 text-slate-500">{row.students}</td>
                    <td className="px-4 py-3 text-slate-500">{formatINR(row.feesInvoiced)}</td>
                    <td className="px-4 py-3 text-green-700">{formatINR(row.revenueCollected)}</td>
                    <td className="px-4 py-3 text-red-600">{formatINR(row.outstanding)}</td>
                  </tr>
                ))}
                {summaryQuery.isSuccess && summaryQuery.data.byBranch.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">By course</h2>
          <ExportCsvButton
            filename="revenue-by-course"
            headers={["Course", "Code", "Students", "Fees invoiced"]}
            rows={(summaryQuery.data?.byCourse ?? []).map((r) => [r.courseName, r.courseCode, r.students, r.feesInvoiced])}
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Fees invoiced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaryQuery.isLoading && <TableLoadingRow colSpan={3} />}
              {summaryQuery.data?.byCourse.map((row) => (
                <tr key={row.courseId}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.courseName} <span className="font-normal text-slate-400">({row.courseCode})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.students}</td>
                  <td className="px-4 py-3 text-slate-500">{formatINR(row.feesInvoiced)}</td>
                </tr>
              ))}
              {summaryQuery.isSuccess && summaryQuery.data.byCourse.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent payments</h2>
          <ExportCsvButton
            filename="recent-payments"
            headers={["Student", "Amount", "Method", "Date"]}
            rows={(summaryQuery.data?.recentPayments ?? []).map((p) => [
              p.studentName,
              p.amount,
              p.method,
              new Date(p.paidAt).toLocaleDateString(),
            ])}
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaryQuery.isLoading && <TableLoadingRow colSpan={4} />}
              {summaryQuery.data?.recentPayments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.studentName}</td>
                  <td className="px-4 py-3 text-green-700">{formatINR(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.method.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {summaryQuery.isSuccess && summaryQuery.data.recentPayments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
