import { useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/format";

interface TrendColumnChartProps {
  data: { month: string; year: number; revenue: number }[];
  colorVar?: string;
}

const CHART_HEIGHT = 160;

/** Trend-over-time — column chart, one hue, endpoint direct-labeled, rest reachable on hover. */
export function TrendColumnChart({ data, colorVar = "--viz-series-1" }: TrendColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const lastIndex = data.length - 1;

  return (
    <div className="viz-root flex flex-col gap-2">
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {data.map((d, i) => {
          const heightPct = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 2 : 0.5);
          const isEmphasized = i === lastIndex || i === hovered;
          return (
            <div
              key={`${d.year}-${d.month}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
              tabIndex={0}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered((h) => (h === i ? null : h))}
            >
              {hovered === i && (
                <div className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md bg-[color:var(--viz-text-primary)] px-2 py-1 text-xs font-medium text-[color:var(--viz-surface)] shadow-lg">
                  {d.month} {d.year}: {formatINR(d.revenue)}
                </div>
              )}
              {i === lastIndex && (
                <span className="mb-1 text-[10px] font-semibold text-[color:var(--viz-text-primary)]">
                  {formatINRCompact(d.revenue)}
                </span>
              )}
              <div
                className="w-full max-w-6 rounded-t-[4px] transition-[filter]"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: `var(${colorVar})`,
                  filter: isEmphasized ? undefined : "opacity(0.75)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-[color:var(--viz-baseline)] pt-1.5">
        {data.map((d, i) => (
          <span
            key={`${d.year}-${d.month}-label`}
            className="flex-1 text-center text-[11px] text-[color:var(--viz-text-muted)]"
          >
            {i % 2 === 0 || data.length <= 6 ? d.month : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
