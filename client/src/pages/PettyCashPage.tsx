import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  createPettyCashEntry,
  deletePettyCashEntry,
  fetchPettyCashBalances,
  fetchPettyCashEntries,
  reviewPettyCashEntry,
  unreviewPettyCashEntry,
  uploadPettyCashReceipt,
} from "@/lib/pettyCashApi";
import {
  createPettyCashRequisition,
  decidePettyCashRequisition,
  fetchPettyCashRequisitions,
  fulfillPettyCashRequisition,
} from "@/lib/pettyCashRequisitionsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { StatTile } from "@/components/charts/StatTile";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TableLoadingRow } from "@/components/Spinner";
import type { PettyCashType } from "@/types/pettyCash";
import type { PettyCashRequisition, PettyCashRequisitionStatus } from "@/types/pettyCashRequisition";

const CATEGORY_SUGGESTIONS = ["Stationery", "Refreshments", "Local transport", "Maintenance & repairs", "Utilities", "Courier & postage", "Miscellaneous"];

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PettyCashPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAccountant = user?.role === "ACCOUNTANT";
  const isBranchAdmin = user?.role === "BRANCH_ADMIN";
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"cashbox" | "requisitions">("cashbox");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState<PettyCashType | "">("");
  const [reviewed, setReviewed] = useState<"" | "true" | "false">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: seesAllBranches });
  const balancesQuery = useQuery({
    queryKey: ["petty-cash-balances", branchId],
    queryFn: () => fetchPettyCashBalances(branchId || undefined),
  });
  const entriesQuery = useQuery({
    queryKey: ["petty-cash-entries", branchId, type, reviewed, from, to],
    queryFn: () =>
      fetchPettyCashEntries({ branchId: branchId || undefined, type: type || undefined, reviewed: reviewed || undefined, from, to }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["petty-cash-balances"] });
    queryClient.invalidateQueries({ queryKey: ["petty-cash-entries"] });
  };

  const entries = entriesQuery.data ?? [];
  const balances = balancesQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Petty cash</h1>
        <p className="text-sm text-slate-500">Track each branch's day-to-day cash box — top-ups in, small expenses out.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {(["cashbox", "requisitions"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "cashbox" ? "Cash box" : "Requisitions"}
          </button>
        ))}
      </div>

      {tab === "cashbox" ? (
        <>
          <BalanceSummary balances={balances} isLoading={balancesQuery.isLoading} showBranchColumn={seesAllBranches && !branchId} />

          {(isSuperAdmin || isBranchAdmin) && (
            <EntryForm branches={branchesQuery.data ?? []} seesAllBranches={seesAllBranches} isSuperAdmin={isSuperAdmin} onCreated={invalidate} />
          )}

          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            {seesAllBranches && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Branch</span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
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
              <span className="text-xs font-medium text-slate-500">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as PettyCashType | "")} className="input">
                <option value="">All entries</option>
                <option value="TOP_UP">Top-up</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </label>
            {isSuperAdmin && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Review status</span>
                <select value={reviewed} onChange={(e) => setReviewed(e.target.value as "" | "true" | "false")} className="input">
                  <option value="">All</option>
                  <option value="false">Needs review</option>
                  <option value="true">Reviewed</option>
                </select>
              </label>
            )}
            <div className="ml-auto">
              <ExportCsvButton
                filename={`petty-cash-${from || "all"}-to-${to || "all"}`}
                headers={["Date", "Branch", "Type", "Category", "Description", "Amount", "Recorded by", "Bill"]}
                rows={entries.map((e) => [
                  new Date(e.occurredAt).toLocaleDateString(),
                  e.branch.name,
                  e.type === "TOP_UP" ? "Top-up" : "Expense",
                  e.category ?? "",
                  e.description ?? "",
                  e.amount,
                  e.recordedBy.name,
                  e.receiptUrl ? `${window.location.origin}${e.receiptUrl}` : "",
                ])}
              />
            </div>
          </div>

          <EntriesTable
            entries={entries}
            isLoading={entriesQuery.isLoading}
            showBranchColumn={seesAllBranches}
            canDelete={isSuperAdmin}
            canReview={isSuperAdmin}
            onDeleted={invalidate}
          />
        </>
      ) : (
        <RequisitionsSection
          branches={branchesQuery.data ?? []}
          seesAllBranches={seesAllBranches}
          isSuperAdmin={isSuperAdmin}
          isAccountant={isAccountant}
          isBranchAdmin={isBranchAdmin}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function BalanceSummary({
  balances,
  isLoading,
  showBranchColumn,
}: {
  balances: { branches: { branchId: string; branchName: string; topUps: number; expenses: number; balance: number }[]; totals: { topUps: number; expenses: number; balance: number } } | undefined;
  isLoading: boolean;
  showBranchColumn: boolean;
}) {
  if (isLoading || !balances) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Current balance" value="—" />
        <StatTile label="Total topped up" value="—" />
        <StatTile label="Total spent" value="—" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Current balance" value={formatINR(balances.totals.balance)} tone={balances.totals.balance < 0 ? "negative" : "positive"} />
        <StatTile label="Total topped up" value={formatINR(balances.totals.topUps)} />
        <StatTile label="Total spent" value={formatINR(balances.totals.expenses)} />
      </div>
      {showBranchColumn && balances.branches.length > 1 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Topped up</th>
                <th className="px-4 py-3">Spent</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.branches.map((b) => (
                <tr key={b.branchId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{b.branchName}</td>
                  <td className="px-4 py-3 text-slate-500">{formatINR(b.topUps)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatINR(b.expenses)}</td>
                  <td className={`px-4 py-3 font-medium ${b.balance < 0 ? "text-red-600" : "text-green-700"}`}>{formatINR(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EntryForm({
  branches,
  seesAllBranches,
  isSuperAdmin,
  onCreated,
}: {
  branches: { id: string; name: string }[];
  seesAllBranches: boolean;
  isSuperAdmin: boolean;
  onCreated: () => void;
}) {
  const [type, setType] = useState<PettyCashType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayStr());
  const [branchId, setBranchId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (type === "EXPENSE" && !receiptFile) throw new Error("A bill/receipt is required for an expense");
      return createPettyCashEntry(
        {
          type,
          amount: Number(amount),
          category: type === "EXPENSE" ? category || undefined : undefined,
          description: description || undefined,
          occurredAt: occurredAt || undefined,
          branchId: seesAllBranches ? branchId || undefined : undefined,
        },
        receiptFile ?? undefined,
      );
    },
    onSuccess: () => {
      setAmount("");
      setCategory("");
      setDescription("");
      setOccurredAt(todayStr());
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onCreated();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to record entry");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Record an entry</h2>
      <div className="flex flex-wrap items-end gap-3">
        {isSuperAdmin ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Type</span>
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value as PettyCashType;
                setType(next);
                if (next !== "EXPENSE") {
                  setReceiptFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
              className="input"
            >
              <option value="EXPENSE">Expense</option>
              <option value="TOP_UP">Top-up</option>
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Type</span>
            <span className="input flex items-center border-transparent bg-slate-50 text-slate-500">Expense</span>
          </div>
        )}
        {seesAllBranches && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required className="input">
              <option value="" disabled>
                Select branch
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-32" />
        </label>
        {type === "EXPENSE" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} list="petty-cash-categories" placeholder="e.g. Stationery" className="input w-44" />
            <datalist id="petty-cash-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Date</span>
          <input type="date" value={occurredAt} max={todayStr()} onChange={(e) => setOccurredAt(e.target.value)} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Description (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full sm:w-56" />
        </label>
        {type === "EXPENSE" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Bill / receipt</span>
            <input
              ref={fileInputRef}
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {mutation.isPending ? "Recording…" : "Record"}
        </button>
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}

function EntriesTable({
  entries,
  isLoading,
  showBranchColumn,
  canDelete,
  canReview,
  onDeleted,
}: {
  entries: {
    id: string;
    type: PettyCashType;
    amount: number;
    category: string | null;
    description: string | null;
    receiptUrl: string | null;
    occurredAt: string;
    branch: { name: string };
    recordedBy: { name: string };
    reviewedBy: { id: string; name: string } | null;
  }[];
  isLoading: boolean;
  showBranchColumn: boolean;
  canDelete: boolean;
  canReview: boolean;
  onDeleted: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => deletePettyCashEntry(id),
    onSuccess: onDeleted,
    onSettled: () => setDeletingId(null),
  });

  const receiptMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadPettyCashReceipt(id, file),
    onSuccess: onDeleted,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, reviewed }: { id: string; reviewed: boolean }) =>
      reviewed ? reviewPettyCashEntry(id) : unreviewPettyCashEntry(id),
    onSuccess: onDeleted,
    onSettled: () => setReviewingId(null),
  });

  const handleDelete = (e: { id: string; amount: number; type: PettyCashType; occurredAt: string }) => {
    const confirmed = window.confirm(
      `Permanently delete this ${formatINR(e.amount)} ${e.type === "TOP_UP" ? "top-up" : "expense"} entry from ${new Date(e.occurredAt).toLocaleDateString()}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(e.id);
    mutation.mutate(e.id);
  };

  const toggleReviewed = (id: string, currentlyReviewed: boolean) => {
    setReviewingId(id);
    reviewMutation.mutate({ id, reviewed: !currentlyReviewed });
  };

  const hasActionsColumn = canDelete || canReview;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            {showBranchColumn && <th className="px-4 py-3">Branch</th>}
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Recorded by</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Bill</th>
            {canReview && <th className="px-4 py-3">Reviewed</th>}
            {hasActionsColumn && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && <TableLoadingRow colSpan={(showBranchColumn ? 8 : 7) + (canReview ? 1 : 0) + (hasActionsColumn ? 1 : 0)} />}
          {entries.map((e) => {
            const isReviewing = reviewMutation.isPending && reviewingId === e.id;
            return (
              <tr key={e.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(e.occurredAt).toLocaleDateString()}</td>
                {showBranchColumn && <td className="px-4 py-3 text-slate-500">{e.branch.name}</td>}
                <td className="px-4 py-3 text-slate-500">{e.type === "TOP_UP" ? "Top-up" : e.category || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{e.description || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{e.recordedBy.name}</td>
                <td className={`px-4 py-3 font-medium ${e.type === "TOP_UP" ? "text-green-700" : "text-red-600"}`}>
                  {e.type === "TOP_UP" ? "+ " : "− "}
                  {formatINR(e.amount)}
                </td>
                <td className="px-4 py-3">
                  {e.receiptUrl ? (
                    <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">
                      View bill
                    </a>
                  ) : (
                    <label className="text-xs font-medium text-brand-600 hover:underline">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                        disabled={receiptMutation.isPending}
                        onChange={(ev) => {
                          const file = ev.target.files?.[0];
                          if (file) receiptMutation.mutate({ id: e.id, file });
                        }}
                      />
                      {receiptMutation.isPending && receiptMutation.variables?.id === e.id ? "Uploading…" : "Attach bill"}
                    </label>
                  )}
                </td>
                {canReview && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => toggleReviewed(e.id, Boolean(e.reviewedBy))}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-60 ${
                        e.reviewedBy ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                      title={e.reviewedBy ? `Reviewed by ${e.reviewedBy.name}` : "Needs review"}
                    >
                      {isReviewing ? "…" : e.reviewedBy ? "Reviewed" : "Needs review"}
                    </button>
                  </td>
                )}
                {hasActionsColumn && (
                  <td className="px-4 py-3 text-right">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        disabled={mutation.isPending && deletingId === e.id}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                      >
                        {mutation.isPending && deletingId === e.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!isLoading && entries.length === 0 && (
            <tr>
              <td
                colSpan={(showBranchColumn ? 8 : 7) + (canReview ? 1 : 0) + (hasActionsColumn ? 1 : 0)}
                className="px-4 py-6 text-center text-slate-400"
              >
                No petty cash entries in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RequisitionsSection({
  branches,
  seesAllBranches,
  isSuperAdmin,
  isAccountant,
  isBranchAdmin,
  onChanged,
}: {
  branches: { id: string; name: string }[];
  seesAllBranches: boolean;
  isSuperAdmin: boolean;
  isAccountant: boolean;
  isBranchAdmin: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PettyCashRequisitionStatus | "">("");
  const [branchId, setBranchId] = useState("");

  const requisitionsQuery = useQuery({
    queryKey: ["petty-cash-requisitions", branchId, status],
    queryFn: () => fetchPettyCashRequisitions({ branchId: branchId || undefined, status: status || undefined }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["petty-cash-requisitions"] });
    onChanged();
  };

  return (
    <div className="flex flex-col gap-6">
      {isBranchAdmin && <RequisitionRequestForm onCreated={invalidate} />}

      <div className="flex flex-wrap items-end gap-3">
        {seesAllBranches && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as PettyCashRequisitionStatus | "")} className="input">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="FULFILLED">Topped up</option>
          </select>
        </label>
      </div>

      <RequisitionsTable
        requisitions={requisitionsQuery.data ?? []}
        isLoading={requisitionsQuery.isLoading}
        showBranchColumn={seesAllBranches}
        canDecide={isSuperAdmin}
        canFulfill={isSuperAdmin || isAccountant}
        onChanged={invalidate}
      />
    </div>
  );
}

function RequisitionRequestForm({ onCreated }: { onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => createPettyCashRequisition({ amount: Number(amount), reason: reason || undefined }),
    onSuccess: () => {
      setAmount("");
      setReason("");
      onCreated();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to submit request");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Request a top-up</h2>
      <p className="mb-3 text-xs text-slate-500">Sent to the super admin for approval, then forwarded to accounts to action.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-32" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Running low on cash" className="input w-full sm:w-72" />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Submit request"}
        </button>
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}

const STATUS_STYLES: Record<PettyCashRequisitionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  FULFILLED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<PettyCashRequisitionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FULFILLED: "Topped up",
};

function StatusBadge({ status }: { status: PettyCashRequisitionStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function RequisitionsTable({
  requisitions,
  isLoading,
  showBranchColumn,
  canDecide,
  canFulfill,
  onChanged,
}: {
  requisitions: PettyCashRequisition[];
  isLoading: boolean;
  showBranchColumn: boolean;
  canDecide: boolean;
  canFulfill: boolean;
  onChanged: () => void;
}) {
  const [actingId, setActingId] = useState<string | null>(null);

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: "APPROVED" | "REJECTED"; notes?: string }) =>
      decidePettyCashRequisition(id, decision, notes),
    onSuccess: onChanged,
    onSettled: () => setActingId(null),
  });

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => fulfillPettyCashRequisition(id),
    onSuccess: onChanged,
    onSettled: () => setActingId(null),
  });

  const handleApprove = (id: string, amount: number, branchName: string) => {
    const confirmed = window.confirm(
      `Approve this ${formatINR(amount)} requisition for ${branchName}? It will be forwarded to accounts for the actual top-up.`,
    );
    if (!confirmed) return;
    setActingId(id);
    decideMutation.mutate({ id, decision: "APPROVED" });
  };

  const handleReject = (id: string) => {
    const notes = window.prompt("Reason for rejecting this requisition (optional):");
    if (notes === null) return;
    setActingId(id);
    decideMutation.mutate({ id, decision: "REJECTED", notes: notes || undefined });
  };

  const handleFulfill = (id: string, amount: number, branchName: string) => {
    const confirmed = window.confirm(`Confirm ${formatINR(amount)} has been handed to ${branchName}? This adds it to their cash box.`);
    if (!confirmed) return;
    setActingId(id);
    fulfillMutation.mutate(id);
  };

  const hasActionsColumn = canDecide || canFulfill;
  const colSpan = (showBranchColumn ? 6 : 5) + (hasActionsColumn ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            {showBranchColumn && <th className="px-4 py-3">Branch</th>}
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Requested by</th>
            <th className="px-4 py-3">Status</th>
            {hasActionsColumn && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && <TableLoadingRow colSpan={colSpan} />}
          {requisitions.map((r) => {
            const isActing = actingId === r.id && (decideMutation.isPending || fulfillMutation.isPending);
            return (
              <tr key={r.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                {showBranchColumn && <td className="px-4 py-3 text-slate-500">{r.branch.name}</td>}
                <td className="px-4 py-3 font-medium text-slate-800">{formatINR(r.amount)}</td>
                <td className="px-4 py-3 text-slate-500">{r.reason || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{r.requestedBy.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={r.status} />
                    {r.status === "REJECTED" && r.decisionNotes && <span className="text-xs text-slate-400">{r.decisionNotes}</span>}
                    {r.status === "FULFILLED" && r.fulfilledBy && <span className="text-xs text-slate-400">By {r.fulfilledBy.name}</span>}
                  </div>
                </td>
                {hasActionsColumn && (
                  <td className="px-4 py-3 text-right">
                    {canDecide && r.status === "PENDING" && (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleApprove(r.id, r.amount, r.branch.name)}
                          className="text-xs font-medium text-green-700 hover:underline disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleReject(r.id)}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {canFulfill && r.status === "APPROVED" && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleFulfill(r.id, r.amount, r.branch.name)}
                        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
                      >
                        {isActing ? "Topping up…" : "Mark as topped up"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!isLoading && requisitions.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400">
                No requisitions to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
