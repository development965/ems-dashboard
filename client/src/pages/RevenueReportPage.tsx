import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRevenueReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

type SortKey = "branchName" | "revenue" | "payments" | "outstanding";

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Defaults to the current calendar month, matching this report's original "this month" framing. */
function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function RevenueReportPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [{ from, to }, setRange] = useState(currentMonthBounds());
  const [branchId, setBranchId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const reportQuery = useQuery({
    queryKey: ["revenue-report", branchId, from, to],
    queryFn: () => fetchRevenueReport(branchId || undefined, from || undefined, to || undefined),
  });

  const sortedBranches = useMemo(() => {
    const rows = reportQuery.data?.branches ?? [];
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      return (av as number) - (bv as number);
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [reportQuery.data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const totals = reportQuery.data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={(v) => setRange((r) => ({ ...r, from: v }))}
          onToChange={(v) => setRange((r) => ({ ...r, to: v }))}
        />
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
        <StatTile label="Revenue in range" value={totals ? formatINR(totals.revenue) : "—"} tone="positive" />
        <StatTile label="Payments in range" value={totals?.payments ?? "—"} />
        <StatTile label="Outstanding (current)" value={totals ? formatINR(totals.outstanding) : "—"} tone="negative" />
      </div>

      <div className="flex justify-end">
        <ExportCsvButton
          filename={`revenue-report-${from || "all"}-to-${to || "all"}`}
          headers={["Branch", "Revenue in range", "Payments", "Outstanding (current)"]}
          rows={sortedBranches.map((r) => [r.branchName, r.revenue, r.payments, r.outstanding])}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("branchName")}>
                Branch{sortArrow("branchName")}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("revenue")}>
                Revenue in range{sortArrow("revenue")}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("payments")}>
                Payments{sortArrow("payments")}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("outstanding")}>
                Outstanding (current){sortArrow("outstanding")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportQuery.isLoading && <TableLoadingRow colSpan={4} />}
            {sortedBranches.map((row) => (
              <tr key={row.branchId}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link
                    to={`/reports/receipts?branchId=${row.branchId}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                    className="text-brand-600 hover:underline"
                  >
                    {row.branchName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-green-700">{formatINR(row.revenue)}</td>
                <td className="px-4 py-3 text-slate-500">{row.payments}</td>
                <td className="px-4 py-3 text-red-600">{formatINR(row.outstanding)}</td>
              </tr>
            ))}
            {reportQuery.isSuccess && sortedBranches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No branches in scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
