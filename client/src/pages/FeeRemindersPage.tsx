import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFeeReminder, fetchStudentsNeedingReminders } from "@/lib/feeRemindersApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { TableLoadingRow } from "@/components/Spinner";

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function whatsAppLink(phone: string, studentName: string, courseName: string, balanceDue: number, branchName: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  const message = `Hi ${studentName}, this is a reminder from Techmaax ${branchName} that you have a balance of ${formatINR(
    balanceDue,
  )} due for your ${courseName} course. Please clear it at your earliest convenience. Thank you!`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

export function FeeRemindersPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const remindersQuery = useQuery({
    queryKey: ["fee-reminders", branchId],
    queryFn: () => fetchStudentsNeedingReminders(branchId || undefined),
  });

  const mutation = useMutation({
    mutationFn: createFeeReminder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fee-reminders"] }),
  });

  const filtered = useMemo(() => {
    const rows = remindersQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) => s.studentName.toLowerCase().includes(term) || s.phone.includes(term));
  }, [remindersQuery.data, search]);

  const neverReminded = (remindersQuery.data ?? []).filter((s) => !s.lastReminderAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fee reminders</h1>
        <p className="text-sm text-slate-500">Students with a balance due, oldest-reminded first.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Students with dues" value={remindersQuery.data?.length ?? "—"} />
        <StatTile label="Never reminded" value={neverReminded} tone={neverReminded > 0 ? "negative" : "default"} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Balance due</th>
              <th className="px-4 py-3">Last reminder</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {remindersQuery.isLoading && <TableLoadingRow colSpan={isSuperAdmin ? 6 : 5} />}
            {filtered.map((s) => (
              <tr key={s.studentId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {s.studentName}
                  <div className="text-xs font-normal text-slate-400">{s.phone}</div>
                </td>
                {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{s.branchName}</td>}
                <td className="px-4 py-3 text-slate-500">{s.courseName}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{formatINR(s.balanceDue)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {s.lastReminderAt ? (
                    <>
                      {daysSince(s.lastReminderAt)}d ago
                      <span className="text-xs text-slate-400"> ({s.lastReminderChannel})</span>
                    </>
                  ) : (
                    <span className="text-amber-600">Never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a
                      href={whatsAppLink(s.phone, s.studentName, s.courseName, s.balanceDue, s.branchName)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => mutation.mutate({ studentId: s.studentId, channel: "WHATSAPP" })}
                      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ studentId: s.studentId, channel: "CALL" })}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Mark called
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {remindersQuery.isSuccess && filtered.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-6 text-center text-slate-400">
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
