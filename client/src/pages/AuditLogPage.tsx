import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditActionOptions, fetchAuditLogs } from "@/lib/auditApi";
import { fetchBranches } from "@/lib/branchesApi";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

function actionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditLogPage() {
  const [branchId, setBranchId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const optionsQuery = useQuery({ queryKey: ["audit-actions"], queryFn: fetchAuditActionOptions });
  const logsQuery = useQuery({
    queryKey: ["audit-logs", branchId, action, entityType, from, to],
    queryFn: () =>
      fetchAuditLogs({
        branchId: branchId || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500">Who did what, when — enrollments, fee changes, discounts, and account changes.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="input">
            <option value="">All actions</option>
            {optionsQuery.data?.actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Entity</span>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input">
            <option value="">All</option>
            {optionsQuery.data?.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logsQuery.isLoading && <TableLoadingRow colSpan={5} />}
            {logsQuery.data?.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{log.actorName}</td>
                <td className="px-4 py-3 text-slate-500">{log.branch?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {actionLabel(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{log.summary}</td>
              </tr>
            ))}
            {logsQuery.isSuccess && logsQuery.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No matching activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
