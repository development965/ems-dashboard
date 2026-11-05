import { useState } from "react";
import { formatINR } from "@/lib/format";

interface DonutSlice {
  label: string;
  value: number;
  colorVar: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  centerLabel?: string;
  emptyMessage?: string;
}

const SIZE = 160;
const RADIUS = 64;
const STROKE = 26;
const CENTER = SIZE / 2;
const GAP_DEGREES = 2;

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number) {
  const start = polarToCartesian(endDeg);
  const end = polarToCartesian(startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/** Part-to-whole for a small, fixed category count (payment channels) — pie/donut is the right form here. */
export function DonutChart({ data, centerLabel, emptyMessage = "No data yet." }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return <p className="viz-root py-6 text-center text-sm text-[color:var(--viz-text-muted)]">{emptyMessage}</p>;
  }

  let cursor = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = d.value / total;
      const sweep = fraction * 360;
      const startDeg = cursor + GAP_DEGREES / 2;
      const endDeg = cursor + sweep - GAP_DEGREES / 2;
      cursor += sweep;
      return { ...d, startDeg: Math.max(startDeg, cursor - sweep), endDeg: Math.max(endDeg, startDeg + 0.1) };
    });

  return (
    <div className="viz-root flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        {slices.map((s, i) => (
          <path
            key={s.label}
            d={arcPath(s.startDeg, s.endDeg)}
            fill="none"
            stroke={`var(${s.colorVar})`}
            strokeWidth={hovered === i ? STROKE + 4 : STROKE}
            strokeLinecap="butt"
            style={{ transition: "stroke-width 120ms" }}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
          >
            <title>
              {s.label}: {formatINR(s.value)} ({((s.value / total) * 100).toFixed(0)}%)
            </title>
          </path>
        ))}
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          className="fill-[color:var(--viz-text-primary)] text-[13px] font-semibold"
        >
          {centerLabel ?? formatINR(total)}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-[color:var(--viz-text-muted)] text-[10px]">
          Total
        </text>
      </svg>

      <div className="flex flex-1 flex-col gap-1.5">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm"
            style={{ backgroundColor: hovered === i ? "var(--viz-gridline)" : undefined }}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
          >
            <span className="flex items-center gap-2 text-[color:var(--viz-text-secondary)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: `var(${d.colorVar})` }} />
              {d.label}
            </span>
            <span className="font-medium text-[color:var(--viz-text-primary)]">
              {formatINR(d.value)} <span className="text-[color:var(--viz-text-muted)]">({((d.value / total) * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
