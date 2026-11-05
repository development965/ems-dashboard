import { useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/format";

interface HorizontalBarChartProps {
  data: { label: string; value: number }[];
  colorVar?: string;
  emptyMessage?: string;
}

/** Magnitude comparison across categories — bar, not pie, per dataviz guidance once category count grows. */
export function HorizontalBarChart({ data, colorVar = "--viz-series-1", emptyMessage = "No data yet." }: HorizontalBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return <p className="viz-root py-6 text-center text-sm text-[color:var(--viz-text-muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="viz-root flex flex-col gap-2.5">
      {data.map((d, i) => {
        const widthPct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
        return (
          <div
            key={d.label}
            className="group relative flex items-center gap-3"
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
            tabIndex={0}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered((h) => (h === i ? null : h))}
          >
            <span className="w-32 shrink-0 truncate text-sm text-[color:var(--viz-text-secondary)]" title={d.label}>
              {d.label}
            </span>
            <div className="h-4 flex-1 rounded-full" style={{ backgroundColor: "var(--viz-gridline)" }}>
              <div
                className="h-4 rounded-full transition-[filter]"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `var(${colorVar})`,
                  filter: hovered === i ? "brightness(0.9)" : undefined,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-[color:var(--viz-text-primary)]">
              {formatINRCompact(d.value)}
            </span>
            {hovered === i && (
              <div className="pointer-events-none absolute -top-8 left-32 z-10 rounded-md bg-[color:var(--viz-text-primary)] px-2 py-1 text-xs font-medium text-[color:var(--viz-surface)] shadow-lg">
                {d.label}: {formatINR(d.value)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
