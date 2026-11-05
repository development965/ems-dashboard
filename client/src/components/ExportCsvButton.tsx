import { useAuthStore } from "@/store/authStore";
import { downloadCsv } from "@/lib/csv";
import type { Role } from "@/types/auth";

interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
  disabled?: boolean;
  /** Opt a specific page into letting additional roles export too (e.g. branch admins
   * downloading their own branch's receipts) without changing the default everywhere else. */
  extraRoles?: Role[];
}

/** CSV export is a Super Admin / Accountant capability by default — branch admins don't get
 * this button unless a page explicitly opts them in via `extraRoles`. */
export function ExportCsvButton({ filename, headers, rows, label = "Export CSV", disabled, extraRoles }: ExportCsvButtonProps) {
  const user = useAuthStore((state) => state.user);
  const canExport = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT" || (!!user && !!extraRoles?.includes(user.role));
  if (!canExport) return null;

  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, headers, rows)}
      disabled={disabled || rows.length === 0}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      ⬇ {label}
    </button>
  );
}
