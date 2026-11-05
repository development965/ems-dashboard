interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-9 w-9 border-[3px]" };

/** Techmaax-maroon spinner — the one loading indicator used everywhere in the app. */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-brand-200 border-t-brand-600 ${SIZES[size]} ${className}`}
    />
  );
}

/** Centered spinner for a full page/card while its primary query is loading. */
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

/** A `<tr>` spanning the whole table while its data loads — drop straight into a <tbody>. */
export function TableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        <div className="flex flex-col items-center gap-2 text-sm text-slate-400">
          <Spinner />
          <span>Loading...</span>
        </div>
      </td>
    </tr>
  );
}
