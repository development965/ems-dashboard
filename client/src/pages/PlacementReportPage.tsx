import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchPlacementReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { StatTile } from "@/components/charts/StatTile";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

const CERT_LABELS: Record<string, string> = { NOT_ISSUED: "Not issued", ISSUED: "Issued" };
const PLACEMENT_LABELS: Record<string, string> = { NOT_PLACED: "Not placed", IN_PROGRESS: "In progress", PLACED: "Placed" };

export function PlacementReportPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const reportQuery = useQuery({
    queryKey: ["placement-report", branchId, from, to],
    queryFn: () => fetchPlacementReport(branchId || undefined, from || undefined, to || undefined),
  });

  const filtered = useMemo(() => {
    const rows = reportQuery.data?.students ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) => s.studentName.toLowerCase().includes(term) || s.phone.includes(term));
  }, [reportQuery.data, search]);

  const totals = reportQuery.data?.totals;

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Students" value={totals?.students ?? "—"} />
        <StatTile label="Certified" value={totals?.certified ?? "—"} tone="positive" />
        <StatTile label="Placed" value={totals?.placed ?? "—"} tone="positive" />
        <StatTile label="Placement in progress" value={totals?.placementInProgress ?? "—"} />
      </div>

      {isSuperAdmin && !branchId && (
        <section>
          <h2 className="mb-3 font-semibold text-slate-900">By branch</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Certified</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportQuery.isLoading && <TableLoadingRow colSpan={4} />}
                {reportQuery.data?.byBranch.map((row) => (
                  <tr key={row.branchId}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.branchName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.students}</td>
                    <td className="px-4 py-3 text-green-700">{row.certified}</td>
                    <td className="px-4 py-3 text-green-700">{row.placed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <ExportCsvButton
          filename="placement-report"
          headers={["Student", "Phone", "Branch", "Course", "Certification", "Certificate No", "Placement", "Company", "Role", "Package (LPA)"]}
          rows={filtered.map((s) => [
            s.studentName,
            s.phone,
            s.branchName,
            s.courseName,
            CERT_LABELS[s.certificationStatus],
            s.certificateNo ?? "",
            PLACEMENT_LABELS[s.placementStatus],
            s.placementCompany ?? "",
            s.placementRole ?? "",
            s.placementPackageLPA ?? "",
          ])}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Certification</th>
              <th className="px-4 py-3">Placement</th>
              <th className="px-4 py-3">Company / role</th>
              <th className="px-4 py-3">Package</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportQuery.isLoading && <TableLoadingRow colSpan={isSuperAdmin ? 7 : 6} />}
            {filtered.map((s) => (
              <tr key={s.studentId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link to={`/students/${s.studentId}`} target="_blank" rel="noreferrer" className="hover:underline">
                    {s.studentName}
                  </Link>
                </td>
                {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{s.branchName}</td>}
                <td className="px-4 py-3 text-slate-500">{s.courseName}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.certificationStatus === "ISSUED" ? "font-medium text-green-700" : "text-slate-400"
                    }
                  >
                    {CERT_LABELS[s.certificationStatus]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.placementStatus === "PLACED"
                        ? "font-medium text-green-700"
                        : s.placementStatus === "IN_PROGRESS"
                          ? "text-amber-600"
                          : "text-slate-400"
                    }
                  >
                    {PLACEMENT_LABELS[s.placementStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {s.placementCompany ? `${s.placementCompany}${s.placementRole ? ` — ${s.placementRole}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{s.placementPackageLPA ? `₹${s.placementPackageLPA} LPA` : "—"}</td>
              </tr>
            ))}
            {reportQuery.isSuccess && filtered.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-slate-400">
                  {search ? "No matches." : "No students yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
