interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

/** A native calendar date-range picker (From/To) — an implicit "all time" state when both are
 * empty. Uses `<input type="date">` rather than `type="month"` since that renders as a real
 * calendar picker across browsers (Safari's month input is a bare text field). */
export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const clear = () => {
    onFromChange("");
    onToChange("");
  };

  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">From</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} className="input" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">To</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} className="input" />
      </label>
      {(from || to) && (
        <button type="button" onClick={clear} className="mb-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
          All time
        </button>
      )}
    </div>
  );
}
