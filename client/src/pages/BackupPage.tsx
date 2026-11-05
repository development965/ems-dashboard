import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { downloadBackup } from "@/lib/backupApi";
import { fetchAuditLogs } from "@/lib/auditApi";

export function BackupPage() {
  const historyQuery = useQuery({
    queryKey: ["backup-history"],
    queryFn: () => fetchAuditLogs({ action: "backup.downloaded" }),
  });

  const mutation = useMutation({
    mutationFn: downloadBackup,
    onSuccess: () => historyQuery.refetch(),
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to download backup");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backups</h1>
        <p className="text-sm text-slate-500">A full snapshot of the database — every branch, student, and payment.</p>
      </div>

      <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
        <h2 className="font-semibold text-brand-700">Download a backup now</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Generates a standard MySQL dump (<code>.sql</code> file) of the live database, ready to restore if anything ever goes
          wrong. Nothing is stored on the server — it streams straight to your downloads folder. Keep the file somewhere safe
          (and off this laptop alone) — it contains real student and payment data.
        </p>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {mutation.isPending ? "Preparing backup…" : "Download backup"}
        </button>
        {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
        {mutation.isSuccess && <p className="mt-2 text-sm text-green-700">Downloaded.</p>}
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Recent downloads</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Downloaded by</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyQuery.data?.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.actorName}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {historyQuery.isSuccess && historyQuery.data.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                    No backups downloaded yet.
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
