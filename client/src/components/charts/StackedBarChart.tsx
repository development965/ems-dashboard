import { useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/format";

const SERIES_VARS = [
  "--viz-series-1",
  "--viz-series-2",
  "--viz-series-3",
  "--viz-series-4",
  "--viz-series-5",
  "--viz-series-6",
  "--viz-series-7",
  "--viz-series-8",
];

interface StackedBarChartProps {
  months: { month: string; year: number; byBranch: Record<string, number>; total: number }[];
  series: { id: string; name: string }[];
}

const CHART_HEIGHT = 220;

/** Tell distinct series apart over time — categorical color, one hue per branch, fixed order. */
export function StackedBarChart({ months, series }: StackedBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...months.map((m) => m.total), 1);
  const colorFor = (i: number) => SERIES_VARS[i % SERIES_VARS.length];

  return (
    <div className="viz-root flex flex-col gap-3">
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {months.map((m, i) => (
          <div
            key={`${m.year}-${m.month}`}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
            tabIndex={0}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered((h) => (h === i ? null : h))}
          >
            {hovered === i && (
              <div className="pointer-events-none absolute -top-2 z-10 w-max -translate-y-full rounded-md bg-[color:var(--viz-text-primary)] px-2.5 py-1.5 text-xs text-[color:var(--viz-surface)] shadow-lg">
                <p className="mb-1 font-semibold">
                  {m.month} {m.year} · {formatINR(m.total)}
                </p>
                {series.map((s, si) => {
                  const v = m.byBranch[s.id];
                  if (!v) return null;
                  return (
                    <p key={s.id} className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: `var(${colorFor(si)})` }} />
                      {s.name}: {formatINR(v)}
                    </p>
                  );
                })}
              </div>
            )}
            <div className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${Math.max((m.total / max) * 100, m.total > 0 ? 2 : 0)}%` }}>
              {series.map((s, si) => {
                const v = m.byBranch[s.id] ?? 0;
                if (v <= 0) return null;
                return (
                  <div
                    key={s.id}
                    style={{
                      height: `${(v / m.total) * 100}%`,
                      backgroundColor: `var(${colorFor(si)})`,
                      borderBottom: si > 0 ? "2px solid var(--viz-surface)" : undefined,
                    }}
                    className="w-full"
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-[color:var(--viz-baseline)] pt-1.5">
        {months.map((m, i) => (
          <span key={`${m.year}-${m.month}-l`} className="flex-1 text-center text-[11px] text-[color:var(--viz-text-muted)]">
            {i % 2 === 0 || months.length <= 6 ? m.month : ""}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-[color:var(--viz-text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `var(${colorFor(i)})` }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-right text-xs text-[color:var(--viz-text-muted)]">Peak month: {formatINRCompact(max)}</p>
    </div>
  );
}
