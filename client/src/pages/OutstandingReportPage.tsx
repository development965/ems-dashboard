import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchOutstandingReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

export function OutstandingReportPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const reportQuery = useQuery({
    queryKey: ["outstanding-report", branchId, from, to],
    queryFn: () => fetchOutstandingReport(branchId || undefined, from || undefined, to || undefined),
  });

  const filtered = useMemo(() => {
    const rows = reportQuery.data?.students ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) => s.studentName.toLowerCase().includes(term) || s.phone.includes(term));
  }, [reportQuery.data, search]);

  return (
    <div className="flex flex-col gap-6">
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
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone..." className="input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Students with dues" value={reportQuery.data?.studentsWithDues ?? "—"} />
        <StatTile
          label="Total outstanding"
          value={reportQuery.data ? formatINR(reportQuery.data.totalOutstanding) : "—"}
          tone="negative"
        />
      </div>

      <div className="flex justify-end">
        <ExportCsvButton
          filename="outstanding-dues"
          headers={["Student", "Phone", "Branch", "Course", "Net fee", "Paid", "Balance due", "Enrolled"]}
          rows={filtered.map((s) => [
            s.studentName,
            s.phone,
            s.branchName,
            s.courseName,
            s.netFee,
            s.paid,
            s.balanceDue,
            new Date(s.enrolledAt).toLocaleDateString(),
          ])}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Phone</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Net fee</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Balance due</th>
              <th className="px-4 py-3">Enrolled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportQuery.isLoading && <TableLoadingRow colSpan={isSuperAdmin ? 8 : 7} />}
            {filtered.map((s) => (
              <tr key={s.studentId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link to={`/students/${s.studentId}`} target="_blank" rel="noreferrer" className="hover:underline">
                    {s.studentName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.phone}</td>
                {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{s.branchName}</td>}
                <td className="px-4 py-3 text-slate-500">{s.courseName}</td>
                <td className="px-4 py-3 text-slate-500">{formatINR(s.netFee)}</td>
                <td className="px-4 py-3 text-green-700">{formatINR(s.paid)}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{formatINR(s.balanceDue)}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(s.enrolledAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {reportQuery.isSuccess && filtered.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-6 text-center text-slate-400">
                  {search ? "No matches." : "No outstanding dues — everyone's paid up."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
