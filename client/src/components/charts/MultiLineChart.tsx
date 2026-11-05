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

interface MultiLineChartProps {
  months: { month: string; year: number; byBranch: Record<string, number>; total: number }[];
  series: { id: string; name: string }[];
  showTotal?: boolean;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;

/** Trend over time, multiple series — one hue per branch (fixed order) plus a dashed total. */
export function MultiLineChart({ months, series, showTotal = true }: MultiLineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const colorFor = (i: number) => SERIES_VARS[i % SERIES_VARS.length];

  const maxValue = Math.max(...months.map((m) => m.total), ...series.map((s) => Math.max(...months.map((m) => m.byBranch[s.id] ?? 0))), 1);

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number) => PAD_LEFT + (months.length <= 1 ? innerW / 2 : (i / (months.length - 1)) * innerW);
  const yAt = (v: number) => PAD_TOP + innerH - (v / maxValue) * innerH;

  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");

  return (
    <div className="viz-root flex flex-col gap-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }} preserveAspectRatio="none">
        {series.map((s, si) => (
          <path
            key={s.id}
            d={linePath(months.map((m) => m.byBranch[s.id] ?? 0))}
            fill="none"
            stroke={`var(${colorFor(si)})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {showTotal && series.length > 1 && (
          <path
            d={linePath(months.map((m) => m.total))}
            fill="none"
            stroke="var(--viz-text-primary)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {months.map((m, i) => (
          <rect
            key={`${m.year}-${m.month}`}
            x={xAt(i) - innerW / months.length / 2}
            y={0}
            width={innerW / months.length}
            height={HEIGHT}
            fill="transparent"
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}
        {hovered !== null && <line x1={xAt(hovered)} x2={xAt(hovered)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="var(--viz-baseline)" strokeWidth={1} />}
      </svg>

      <div className="flex items-center gap-2">
        {months.map((m, i) => (
          <span key={`${m.year}-${m.month}-l`} className="flex-1 text-center text-[11px] text-[color:var(--viz-text-muted)]">
            {i % 2 === 0 || months.length <= 6 ? m.month : ""}
          </span>
        ))}
      </div>

      {hovered !== null && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
          <p className="mb-1 font-semibold text-[color:var(--viz-text-primary)]">
            {months[hovered].month} {months[hovered].year} (cumulative)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {series.map((s, si) => (
              <span key={s.id} className="flex items-center gap-1.5 text-[color:var(--viz-text-secondary)]">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: `var(${colorFor(si)})` }} />
                {s.name}: <span className="font-medium text-[color:var(--viz-text-primary)]">{formatINR(months[hovered].byBranch[s.id] ?? 0)}</span>
              </span>
            ))}
            {showTotal && series.length > 1 && (
              <span className="flex items-center gap-1.5 text-[color:var(--viz-text-secondary)]">
                <span className="inline-block h-0.5 w-3 bg-[color:var(--viz-text-primary)]" />
                All branches: <span className="font-medium text-[color:var(--viz-text-primary)]">{formatINR(months[hovered].total)}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-[color:var(--viz-text-secondary)]">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: `var(${colorFor(i)})` }} />
              {s.name}
            </span>
          ))}
          {showTotal && (
            <span className="flex items-center gap-1.5 text-xs text-[color:var(--viz-text-secondary)]">
              <span className="inline-block w-3" style={{ borderTop: "2.5px dashed var(--viz-text-primary)" }} />
              All branches
            </span>
          )}
        </div>
      )}
      <p className="text-right text-xs text-[color:var(--viz-text-muted)]">Peak: {formatINRCompact(maxValue)}</p>
    </div>
  );
}
