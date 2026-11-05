interface StatTileProps {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "negative";
}

export function StatTile({ label, value, tone = "default" }: StatTileProps) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
