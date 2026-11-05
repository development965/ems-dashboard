import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { StatTile } from "@/components/charts/StatTile";
import { DonutChart } from "@/components/charts/DonutChart";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

type SortKey = "branchName" | "total" | "enrolled" | "completed" | "dropped";

const MODE_LABELS: Record<string, string> = { ONLINE: "Online", OFFLINE: "Offline", HYBRID: "Hybrid" };
const MODE_COLORS: Record<string, string> = { OFFLINE: "--viz-series-1", ONLINE: "--viz-series-2", HYBRID: "--viz-series-3" };

export function StudentReportPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const reportQuery = useQuery({
    queryKey: ["student-report", branchId, from, to],
    queryFn: () => fetchStudentReport(branchId || undefined, from || undefined, to || undefined),
  });

  const sortedBranches = useMemo(() => {
    const rows = reportQuery.data?.byBranch ?? [];
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
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };
  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const data = reportQuery.data;
  const maxEnrollment = Math.max(...(data?.monthlyEnrollments.map((m) => m.count) ?? [1]), 1);

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
      </div>
      <p className="-mt-3 text-sm text-slate-500">
        {from || to ? "Students enrolled in the selected date range." : "All students, current snapshot (all time)."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total students" value={data?.totals.total ?? "—"} />
        <StatTile label="Enrolled" value={data?.totals.enrolled ?? "—"} tone="positive" />
        <StatTile label="Completed" value={data?.totals.completed ?? "—"} />
        <StatTile label="Dropped" value={data?.totals.dropped ?? "—"} tone="negative" />
      </div>

      {isSuperAdmin && !branchId && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Students by branch</h2>
            <ExportCsvButton
              filename="students-by-branch"
              headers={["Branch", "Total", "Enrolled", "Completed", "Dropped"]}
              rows={sortedBranches.map((r) => [r.branchName, r.total, r.enrolled, r.completed, r.dropped])}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("branchName")}>
                    Branch{sortArrow("branchName")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("total")}>
                    Total{sortArrow("total")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("enrolled")}>
                    Enrolled{sortArrow("enrolled")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("completed")}>
                    Completed{sortArrow("completed")}
                  </th>
                  <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("dropped")}>
                    Dropped{sortArrow("dropped")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportQuery.isLoading && <TableLoadingRow colSpan={5} />}
                {sortedBranches.map((row) => (
                  <tr key={row.branchId}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.branchName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.total}</td>
                    <td className="px-4 py-3 text-green-700">{row.enrolled}</td>
                    <td className="px-4 py-3 text-slate-500">{row.completed}</td>
                    <td className="px-4 py-3 text-red-600">{row.dropped}</td>
                  </tr>
                ))}
                {reportQuery.isSuccess && sortedBranches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No students yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">By course</h2>
          <div className="flex flex-col gap-2">
            {data?.byCourse.map((c) => (
              <div key={c.courseId} className="flex justify-between border-b border-slate-100 pb-1.5 text-sm last:border-0">
                <span className="text-slate-700">{c.courseName}</span>
                <span className="font-medium text-slate-800">{c.total}</span>
              </div>
            ))}
            {data && data.byCourse.length === 0 && <p className="text-sm text-slate-400">No students yet.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">By mode</h2>
          {data && data.byMode.length > 0 && (
            <DonutChart
              data={data.byMode.map((m) => ({
                label: MODE_LABELS[m.mode] ?? m.mode,
                value: m.total,
                colorVar: MODE_COLORS[m.mode] ?? "--viz-series-8",
              }))}
              centerLabel={String(data.totals.total)}
            />
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">New enrollments — trailing 12 months</h2>
        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {data?.monthlyEnrollments.map((m) => (
            <div key={`${m.year}-${m.month}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-medium text-slate-600">{m.count > 0 ? m.count : ""}</span>
              <div
                className="w-full max-w-8 rounded-t-[4px] bg-brand-500"
                style={{ height: `${Math.max((m.count / maxEnrollment) * 100, m.count > 0 ? 4 : 1)}%` }}
              />
              <span className="text-[11px] text-slate-400">{m.month}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
