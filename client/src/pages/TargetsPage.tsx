import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTargets, setTarget } from "@/lib/targetsApi";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { TableLoadingRow } from "@/components/Spinner";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function achievedTone(pct: number | null): "default" | "positive" | "negative" {
  if (pct === null) return "default";
  return pct >= 100 ? "positive" : pct < 50 ? "negative" : "default";
}

export function TargetsPage() {
  const queryClient = useQueryClient();
  const [{ year, month }, setYearMonth] = useState(currentYearMonth());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const targetsQuery = useQuery({
    queryKey: ["targets", year, month],
    queryFn: () => fetchTargets(year, month),
  });

  const mutation = useMutation({
    mutationFn: (input: { branchId: string; targetAmount: number }) =>
      setTarget({ branchId: input.branchId, year, month, targetAmount: input.targetAmount }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["targets", year, month] }),
  });

  const totals = targetsQuery.data?.totals;
  const totalPct = totals && totals.target > 0 ? Math.round((totals.actual / totals.target) * 1000) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Branch targets</h1>
        <p className="text-sm text-slate-500">Set a monthly revenue target for each branch and track progress against it.</p>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Month</span>
          <select
            value={month}
            onChange={(e) => setYearMonth((s) => ({ ...s, month: Number(e.target.value) }))}
            className="input"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Year</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYearMonth((s) => ({ ...s, year: Number(e.target.value) }))}
            className="input w-24"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total target" value={totals ? formatINR(totals.target) : "—"} />
        <StatTile label="Total actual" value={totals ? formatINR(totals.actual) : "—"} tone="positive" />
        <StatTile label="Achieved" value={totalPct !== null ? `${totalPct}%` : "—"} tone={achievedTone(totalPct)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Actual</th>
              <th className="px-4 py-3">Achieved</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {targetsQuery.isLoading && <TableLoadingRow colSpan={5} />}
            {targetsQuery.data?.branches.map((row) => {
              const draft = drafts[row.branchId] ?? (row.targetAmount !== null ? String(row.targetAmount) : "");
              const tone = achievedTone(row.achievedPct);
              return (
                <tr key={row.branchId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.branchName}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.branchId]: e.target.value }))}
                      placeholder="Not set"
                      className="input w-32"
                    />
                  </td>
                  <td className="px-4 py-3 text-green-700">{formatINR(row.actual)}</td>
                  <td className="px-4 py-3">
                    {row.achievedPct !== null ? (
                      <span
                        className={
                          tone === "positive" ? "font-semibold text-green-700" : tone === "negative" ? "font-semibold text-red-600" : "text-slate-700"
                        }
                      >
                        {row.achievedPct}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={mutation.isPending || !draft}
                      onClick={() => mutation.mutate({ branchId: row.branchId, targetAmount: Number(draft) })}
                      className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
