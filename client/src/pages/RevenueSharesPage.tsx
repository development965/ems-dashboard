import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";
import {
  createRevenueShare,
  deleteRevenueShare,
  fetchRevenueShareBranches,
  fetchRevenueShares,
  settleRevenueShare,
} from "@/lib/revenueSharesApi";
import { fetchPayments } from "@/lib/paymentsApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { TableLoadingRow } from "@/components/Spinner";
import type { RevenueShareStatus } from "@/types/revenueShare";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function RevenueSharesPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canCreate = user?.role === "SUPER_ADMIN" || user?.role === "BRANCH_ADMIN";
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<RevenueShareStatus | "">("");
  const [branchId, setBranchId] = useState("");

  const branchesQuery = useQuery({ queryKey: ["revenue-share-branches"], queryFn: fetchRevenueShareBranches });
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => fetchPayments(), enabled: canCreate });
  const sharesQuery = useQuery({
    queryKey: ["revenue-shares", branchId, status],
    queryFn: () => fetchRevenueShares({ branchId: branchId || undefined, status: status || undefined }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["revenue-shares"] });
  };

  const shares = sharesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue shares</h1>
        <p className="text-sm text-slate-500">
          When a student pays at one branch but another branch actually delivers part of the service, flag the share here — a
          real amount owed between branches, settled once the money's actually handed over.
        </p>
      </div>

      {canCreate && (
        <ShareForm
          payments={paymentsQuery.data ?? []}
          branches={branchesQuery.data ?? []}
          initialPaymentId={searchParams.get("paymentId") ?? undefined}
          onCreated={invalidate}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        {seesAllBranches && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">All branches</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as RevenueShareStatus | "")} className="input">
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="SETTLED">Settled</option>
          </select>
        </label>
      </div>

      <SharesTable shares={shares} isLoading={sharesQuery.isLoading} isSuperAdmin={isSuperAdmin} onChanged={invalidate} />
    </div>
  );
}

function ShareForm({
  payments,
  branches,
  initialPaymentId,
  onCreated,
}: {
  payments: { id: string; amount: number; paidAt: string; student: { name: string }; branch: { id: string; name: string } }[];
  branches: { id: string; name: string }[];
  initialPaymentId?: string;
  onCreated: () => void;
}) {
  const [search, setSearch] = useState("");
  const [paymentId, setPaymentId] = useState(initialPaymentId ?? "");
  const [toBranchId, setToBranchId] = useState("");
  const [splitMode, setSplitMode] = useState<"percent" | "amount">("percent");
  const [splitValue, setSplitValue] = useState("");
  const [note, setNote] = useState("");
  const [transferDate, setTransferDate] = useState(todayStr());

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const pool = term ? payments.filter((p) => p.student.name.toLowerCase().includes(term)) : payments;
    return pool.slice(0, 50);
  }, [payments, search]);

  const selectedPayment = payments.find((p) => p.id === paymentId);
  const branchOptions = branches.filter((b) => b.id !== selectedPayment?.branch.id);

  const mutation = useMutation({
    mutationFn: () =>
      createRevenueShare({
        paymentId,
        toBranchId,
        splitPercent: splitMode === "percent" ? Number(splitValue) : undefined,
        shareAmount: splitMode === "amount" ? Number(splitValue) : undefined,
        note: note || undefined,
        transferDate: transferDate || undefined,
      }),
    onSuccess: () => {
      setPaymentId("");
      setToBranchId("");
      setSplitValue("");
      setNote("");
      setSearch("");
      setTransferDate(todayStr());
      onCreated();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to record the share");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  const computedShare =
    selectedPayment && splitMode === "percent" && splitValue
      ? (selectedPayment.amount * Number(splitValue)) / 100
      : splitMode === "amount"
        ? Number(splitValue) || 0
        : undefined;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Flag a shared collection</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search student</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" className="input w-44" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Payment</span>
          <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} required className="input w-full sm:w-72">
            <option value="" disabled>
              Select the payment collected
            </option>
            {filteredPayments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.student.name} · {formatINR(p.amount)} · {p.branch.name} · {new Date(p.paidAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Service branch</span>
          <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} required disabled={!paymentId} className="input w-44">
            <option value="" disabled>
              Select branch
            </option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Split as</span>
          <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as "percent" | "amount")} className="input w-28">
            <option value="percent">%</option>
            <option value="amount">₹</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">{splitMode === "percent" ? "Percent" : "Amount (₹)"}</span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            max={splitMode === "percent" ? 100 : undefined}
            value={splitValue}
            onChange={(e) => setSplitValue(e.target.value)}
            required
            className="input w-28"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Transfer date</span>
          <input
            type="date"
            value={transferDate}
            max={todayStr()}
            onChange={(e) => setTransferDate(e.target.value)}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ran the batch there" className="input w-full sm:w-56" />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {mutation.isPending ? "Recording…" : "Record share"}
        </button>
      </div>
      {selectedPayment && computedShare !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          {selectedPayment.branch.name} would owe ~{formatINR(computedShare)} of the {formatINR(selectedPayment.amount)} collected.
        </p>
      )}
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}

function StatusBadge({ status }: { status: RevenueShareStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "SETTLED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status === "SETTLED" ? "Settled" : "Pending"}
    </span>
  );
}

function SharesTable({
  shares,
  isLoading,
  isSuperAdmin,
  onChanged,
}: {
  shares: {
    id: string;
    shareAmount: number;
    status: RevenueShareStatus;
    note: string | null;
    settlementNote: string | null;
    transferDate: string;
    payment: { amount: number; paidAt: string; student: { name: string } };
    fromBranch: { name: string };
    toBranch: { name: string };
    recordedBy: { name: string };
    settledBy: { name: string } | null;
  }[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [actingId, setActingId] = useState<string | null>(null);

  const settleMutation = useMutation({
    mutationFn: (id: string) => settleRevenueShare(id),
    onSuccess: onChanged,
    onSettled: () => setActingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRevenueShare(id),
    onSuccess: onChanged,
    onSettled: () => setActingId(null),
  });

  const handleSettle = (s: { id: string; shareAmount: number; fromBranch: { name: string }; toBranch: { name: string } }) => {
    const confirmed = window.confirm(
      `Confirm ${formatINR(s.shareAmount)} has actually been paid from ${s.fromBranch.name} to ${s.toBranch.name}?`,
    );
    if (!confirmed) return;
    setActingId(s.id);
    settleMutation.mutate(s.id);
  };

  const handleDelete = (s: { id: string; shareAmount: number }) => {
    const confirmed = window.confirm(`Permanently delete this ${formatINR(s.shareAmount)} revenue share record?`);
    if (!confirmed) return;
    setActingId(s.id);
    deleteMutation.mutate(s.id);
  };

  const colSpan = 7 + (isSuperAdmin ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Transfer date</th>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">From → To</th>
            <th className="px-4 py-3">Share</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Notes</th>
            {isSuperAdmin && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && <TableLoadingRow colSpan={colSpan} />}
          {shares.map((s) => {
            const isActing = actingId === s.id && (settleMutation.isPending || deleteMutation.isPending);
            return (
              <tr key={s.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(s.transferDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{s.payment.student.name}</td>
                <td className="px-4 py-3 text-slate-500">{formatINR(s.payment.amount)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {s.fromBranch.name} → {s.toBranch.name}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{formatINR(s.shareAmount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {s.note && <div>{s.note}</div>}
                  {s.status === "SETTLED" && s.settledBy && <div>Settled by {s.settledBy.name}</div>}
                  {s.settlementNote && <div>{s.settlementNote}</div>}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {s.status === "PENDING" && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleSettle(s)}
                          className="text-xs font-medium text-green-700 hover:underline disabled:opacity-60"
                        >
                          Settle
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleDelete(s)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {!isLoading && shares.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400">
                No shared collections recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
