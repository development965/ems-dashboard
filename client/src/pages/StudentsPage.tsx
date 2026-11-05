import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchStudents } from "@/lib/studentsApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableLoadingRow } from "@/components/Spinner";

export function StudentsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const studentsQuery = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  const { branchOptions, courseOptions } = useMemo(() => {
    const data = studentsQuery.data ?? [];
    return {
      branchOptions: Array.from(new Set(data.map((s) => s.branch.name))).sort(),
      courseOptions: Array.from(new Set(data.map((s) => s.course.name))).sort(),
    };
  }, [studentsQuery.data]);

  const filtered = useMemo(() => {
    const data = studentsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    return data.filter(
      (s) =>
        (!term ||
          s.name.toLowerCase().includes(term) ||
          s.phone.includes(term) ||
          s.location.toLowerCase().includes(term) ||
          s.course.name.toLowerCase().includes(term)) &&
        (!branchFilter || s.branch.name === branchFilter) &&
        (!courseFilter || s.course.name === courseFilter),
    );
  }, [studentsQuery.data, search, branchFilter, courseFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">Search enrollments and open a profile for fee history, photo and ID.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            filename="students"
            headers={["Name", "Phone", "From", "Course", "Branch", "Fee", "Paid", "Balance", "Status"]}
            rows={filtered.map((s) => [
              s.name,
              s.phone,
              s.location,
              s.course.name,
              s.branch.name,
              s.totalFee,
              s.amountPaid,
              s.balanceDue,
              s.status,
            ])}
          />
          <Link
            to="/students/new"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + Enroll student
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, course, or city..."
            className="input w-full max-w-md"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Course</span>
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="input">
            <option value="">All courses</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {isSuperAdmin && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="input">
              <option value="">All branches</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Course</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {studentsQuery.isLoading && <TableLoadingRow colSpan={isSuperAdmin ? 9 : 8} />}
            {filtered.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link to={`/students/${s.id}`} target="_blank" rel="noreferrer" className="block hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.phone}</td>
                <td className="px-4 py-3 text-slate-500">{s.location}</td>
                <td className="px-4 py-3 text-slate-500">{s.course.name}</td>
                {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{s.branch.name}</td>}
                <td className="px-4 py-3 text-slate-500">{formatINR(s.totalFee)}</td>
                <td className="px-4 py-3 text-green-700">{formatINR(s.amountPaid)}</td>
                <td className="px-4 py-3 font-medium text-red-600">{formatINR(s.balanceDue)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{s.status}</span>
                </td>
              </tr>
            ))}
            {studentsQuery.isSuccess && filtered.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-6 text-center text-slate-400">
                  {search || branchFilter || courseFilter ? "No students match your filters." : "No students enrolled yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
