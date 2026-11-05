import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReceiptsReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { updatePaymentNotes } from "@/lib/paymentsApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";

/** Every filter on this page, in URL-param form. `from`/`to`/`branchId` are sent to the server
 * (they decide which receipts are fetched); the rest narrow the fetched rows in the browser. */
const FILTER_KEYS = ["from", "to", "branchId", "student", "course", "method", "minAmount", "maxAmount", "recordedBy", "remarks"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

/** Payment methods plus the two synthetic transfer rows the receipts endpoint adds. */
const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "RAZORPAY_LINK", label: "Razorpay link" },
  { value: "OTHER", label: "Other" },
  { value: "TRANSFER_IN", label: "Transfer in" },
  { value: "TRANSFER_OUT", label: "Transfer out" },
];

function readFilters(params: URLSearchParams): Filters {
  const filters = {} as Filters;
  for (const key of FILTER_KEYS) filters[key] = params.get(key) ?? "";
  return filters;
}

const isTransferMethod = (method: string) => method === "TRANSFER_IN" || method === "TRANSFER_OUT";

/** Distinct, sorted dropdown options from the fetched rows. The currently selected value is
 * always kept in the list so a selection doesn't silently vanish when the date range changes. */
function distinctOptions(values: string[], selected: string): string[] {
  const set = new Set(values.filter(Boolean));
  if (selected) set.add(selected);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** "" or junk means "no bound" rather than 0. */
function parseAmount(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Receipt-level drill-down behind the Revenue report — "who paid how much", filterable by
 * every column (date, branch, student, course, method, amount, recorded by, remarks). Reachable
 * directly (Reports > Receipts) or via a link from a branch row on the Revenue tab, which
 * pre-fills these same filters through the URL. */
export function ReceiptsReportPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const canEditRemarks = user?.role === "SUPER_ADMIN" || user?.role === "BRANCH_ADMIN" || user?.role === "ACCOUNTANT";
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  // Mirrors `filters` so two updates fired in the same tick (DateRangeFilter's "All time" clears
  // From then To back-to-back) both build on the latest values instead of a stale render.
  const filtersRef = useRef(filters);

  const applyFilters = (next: Partial<Filters>) => {
    const merged = { ...filtersRef.current, ...next };
    filtersRef.current = merged;
    setFilters(merged);
    const params: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      if (merged[key]) params[key] = merged[key];
    }
    setSearchParams(params, { replace: true });
  };

  const { from, to, branchId } = filters;

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const reportQuery = useQuery({
    queryKey: ["receipts-report", branchId, from, to],
    queryFn: () => fetchReceiptsReport(branchId || undefined, from || undefined, to || undefined),
  });

  const fetchedRows = reportQuery.data?.rows;

  const courseOptions = useMemo(
    () => distinctOptions((fetchedRows ?? []).map((r) => r.courseName), filters.course),
    [fetchedRows, filters.course],
  );
  const recordedByOptions = useMemo(
    () => distinctOptions((fetchedRows ?? []).map((r) => r.recordedByName), filters.recordedBy),
    [fetchedRows, filters.recordedBy],
  );

  const rows = useMemo(() => {
    const student = filters.student.trim().toLowerCase();
    const remarks = filters.remarks.trim().toLowerCase();
    const min = parseAmount(filters.minAmount);
    const max = parseAmount(filters.maxAmount);

    return (fetchedRows ?? []).filter((r) => {
      if (student && !r.studentName.toLowerCase().includes(student) && !(r.studentPhone ?? "").toLowerCase().includes(student)) return false;
      if (filters.course && r.courseName !== filters.course) return false;
      if (filters.method && r.method !== filters.method) return false;
      if (filters.recordedBy && r.recordedByName !== filters.recordedBy) return false;
      if (min !== null && r.amount < min) return false;
      if (max !== null && r.amount > max) return false;
      if (remarks && !(r.notes ?? "").toLowerCase().includes(remarks)) return false;
      return true;
    });
  }, [fetchedRows, filters.student, filters.course, filters.method, filters.recordedBy, filters.minAmount, filters.maxAmount, filters.remarks]);

  // Tiles and the CSV follow whatever is on screen, so they're summed from the filtered rows
  // (with no column filters set this equals the server's own totals).
  const hasData = fetchedRows !== undefined;
  const collection = rows.reduce((sum, r) => sum + r.amount, 0);
  const receiptCount = rows.filter((r) => !isTransferMethod(r.method)).length;
  const totalReceiptCount = reportQuery.data?.totals.receipts ?? 0;
  const isNarrowed = hasData && rows.length !== (fetchedRows?.length ?? 0);
  const hasAnyFilter = FILTER_KEYS.some((key) => filters[key] !== "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter from={from} to={to} onFromChange={(v) => applyFilters({ from: v })} onToChange={(v) => applyFilters({ to: v })} />
        {isSuperAdmin && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => applyFilters({ branchId: e.target.value })} className="input">
              <option value="">All branches</option>
              {branchesQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Student</span>
          <input
            type="search"
            value={filters.student}
            onChange={(e) => applyFilters({ student: e.target.value })}
            placeholder="Name or phone…"
            className="input w-44"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Course</span>
          <select value={filters.course} onChange={(e) => applyFilters({ course: e.target.value })} className="input max-w-56">
            <option value="">All courses</option>
            {courseOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Method</span>
          <select value={filters.method} onChange={(e) => applyFilters({ method: e.target.value })} className="input">
            <option value="">All methods</option>
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Min amount</span>
          <input
            type="number"
            inputMode="decimal"
            value={filters.minAmount}
            onChange={(e) => applyFilters({ minAmount: e.target.value })}
            placeholder="₹ from"
            className="input w-28"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Max amount</span>
          <input
            type="number"
            inputMode="decimal"
            value={filters.maxAmount}
            onChange={(e) => applyFilters({ maxAmount: e.target.value })}
            placeholder="₹ to"
            className="input w-28"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Recorded by</span>
          <select value={filters.recordedBy} onChange={(e) => applyFilters({ recordedBy: e.target.value })} className="input max-w-56">
            <option value="">Anyone</option>
            {recordedByOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Remarks</span>
          <input
            type="search"
            value={filters.remarks}
            onChange={(e) => applyFilters({ remarks: e.target.value })}
            placeholder="Transaction ID / note…"
            className="input w-44"
          />
        </label>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => applyFilters(readFilters(new URLSearchParams()))}
            className="mb-1.5 text-xs font-medium text-brand-700 hover:text-brand-600"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="True collection (customer + net transfers)" value={hasData ? formatINR(collection) : "—"} tone="positive" />
        <StatTile
          label={isNarrowed ? "Receipts matching filters" : "Receipts in range"}
          value={!hasData ? "—" : isNarrowed ? `${receiptCount} of ${totalReceiptCount}` : receiptCount}
        />
      </div>

      <div className="flex justify-end">
        <ExportCsvButton
          filename={`receipts-report-${from || "all"}-to-${to || "all"}`}
          headers={["Date", "Student", "Phone", "Branch", "Course", "Method", "Amount", "Recorded by", "Remarks"]}
          extraRoles={["BRANCH_ADMIN"]}
          rows={rows.map((r) => [
            new Date(r.paidAt).toLocaleDateString(),
            r.studentName,
            r.studentPhone,
            r.branchName,
            r.courseName,
            r.method,
            r.amount,
            r.recordedByName,
            r.notes ?? "",
          ])}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Recorded by</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportQuery.isLoading && <TableLoadingRow colSpan={8} />}
            {rows.map((r) => {
              const isTransfer = r.method === "TRANSFER_IN" || r.method === "TRANSFER_OUT";
              return (
                <tr key={r.paymentId} className={isTransfer ? "bg-slate-50/60" : undefined}>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.paidAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.studentName}
                    <div className="text-xs font-normal text-slate-400">{r.studentPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.branchName}</td>
                  <td className="px-4 py-3 text-slate-500">{r.courseName}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.method === "TRANSFER_IN" ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Transfer in</span>
                    ) : r.method === "TRANSFER_OUT" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Transfer out</span>
                    ) : (
                      r.method.replace("_", " ")
                    )}
                  </td>
                  <td className={`px-4 py-3 ${r.amount < 0 ? "text-red-600" : "text-green-700"}`}>{formatINR(r.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.recordedByName}</td>
                  <td className="px-4 py-3">
                    <RemarksCell
                      paymentId={r.paymentId}
                      notes={r.notes}
                      editable={canEditRemarks && !isTransfer}
                      onSaved={() => queryClient.invalidateQueries({ queryKey: ["receipts-report"] })}
                    />
                  </td>
                </tr>
              );
            })}
            {reportQuery.isSuccess && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  {fetchedRows && fetchedRows.length > 0 ? "No receipts match these filters." : "No receipts in this range."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Inline-editable — e.g. a bank transaction ID, typed straight into the report rather than
 * needing a separate edit screen. Saves on blur (or Enter), only if the text actually changed;
 * a stale key forces the input to reset to the server value if a save fails. */
function RemarksCell({
  paymentId,
  notes,
  editable,
  onSaved,
}: {
  paymentId: string;
  notes: string | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(notes ?? "");

  const mutation = useMutation({
    mutationFn: (next: string) => updatePaymentNotes(paymentId, next),
    onSuccess: onSaved,
    onError: () => setValue(notes ?? ""),
  });

  if (!editable) {
    return <span className="text-slate-500">{notes || "—"}</span>;
  }

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed !== (notes ?? "")) {
      setValue(trimmed);
      mutation.mutate(trimmed);
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder="Transaction ID…"
      disabled={mutation.isPending}
      className="w-40 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-slate-600 outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
    />
  );
}
