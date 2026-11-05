import { formatINRCompact } from "@/lib/format";

interface RevenueMatrixProps {
  months: { month: string; year: number; byBranch: Record<string, number>; total: number }[];
  branches: { id: string; name: string }[];
}

function heatStyle(value: number, max: number): React.CSSProperties {
  if (!value) return {};
  const alpha = Math.max(0.08, Math.min(0.85, value / max));
  return { backgroundColor: `rgba(37, 99, 235, ${alpha.toFixed(2)})`, color: alpha > 0.45 ? "#fff" : undefined };
}

/** Sequential single-hue, magnitude by intensity — darker = higher revenue. */
export function RevenueMatrix({ months, branches }: RevenueMatrixProps) {
  const max = Math.max(...months.flatMap((m) => branches.map((b) => m.byBranch[b.id] ?? 0)), 1);
  const rowTotal = (branchId: string) => months.reduce((sum, m) => sum + (m.byBranch[branchId] ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-4 py-3">Branch</th>
            {months.map((m) => (
              <th key={`${m.year}-${m.month}`} className="px-3 py-3 text-right">
                {m.month} {String(m.year).slice(2)}
              </th>
            ))}
            <th className="px-3 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {branches.map((b) => (
            <tr key={b.id}>
              <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">{b.name}</td>
              {months.map((m) => {
                const v = m.byBranch[b.id] ?? 0;
                return (
                  <td key={`${m.year}-${m.month}`} className="px-3 py-2 text-right tabular-nums" style={heatStyle(v, max)}>
                    {v ? formatINRCompact(v) : <span className="text-slate-300">–</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatINRCompact(rowTotal(b.id))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 bg-slate-100 font-semibold text-slate-800">
            <td className="sticky left-0 bg-slate-100 px-4 py-2">All branches</td>
            {months.map((m) => (
              <td key={`${m.year}-${m.month}`} className="px-3 py-2 text-right tabular-nums">
                {formatINRCompact(m.total)}
              </td>
            ))}
            <td className="px-3 py-2 text-right">{formatINRCompact(months.reduce((sum, m) => sum + m.total, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
