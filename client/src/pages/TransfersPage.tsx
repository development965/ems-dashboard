import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRevenueShareBranches, fetchRevenueShares, reviewRevenueShare } from "@/lib/revenueSharesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { TableLoadingRow } from "@/components/Spinner";
import type { RevenueShare, TransferReviewStatus } from "@/types/revenueShare";

const REVIEW_LABELS: Record<TransferReviewStatus, string> = {
  UNREVIEWED: "Unreviewed",
  ACCEPTED: "Accepted",
  DISPUTED: "Disputed",
};

const REVIEW_STYLES: Record<TransferReviewStatus, string> = {
  UNREVIEWED: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

/** Every completed inter-branch transfer (a settled revenue share), for a super admin or
 * accountant to sign off on. Money has already moved by the time anything shows up here —
 * this is a second, independent check that it actually happened as recorded, not a gate on
 * whether it happens. One confirmation (from either role) is enough to mark it reviewed. */
export function TransfersPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const canReview = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState("");
  const [reviewStatus, setReviewStatus] = useState<TransferReviewStatus | "">("");

  const branchesQuery = useQuery({ queryKey: ["revenue-share-branches"], queryFn: fetchRevenueShareBranches, enabled: seesAllBranches });
  const transfersQuery = useQuery({
    queryKey: ["transfers", branchId, reviewStatus],
    queryFn: () => fetchRevenueShares({ branchId: branchId || undefined, status: "SETTLED", reviewStatus: reviewStatus || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transfers"] });

  const transfers = transfersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transfers</h1>
        <p className="text-sm text-slate-500">
          Every completed inter-branch transfer, for a super admin or accountant to review and sign off — accept it as correct,
          or flag it disputed if something's off.
        </p>
      </div>

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
          <span className="text-xs font-medium text-slate-500">Review status</span>
          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as TransferReviewStatus | "")} className="input">
            <option value="">All</option>
            <option value="UNREVIEWED">Unreviewed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </label>
      </div>

      <TransfersTable transfers={transfers} isLoading={transfersQuery.isLoading} showBranchColumn={seesAllBranches} canReview={canReview} onChanged={invalidate} />
    </div>
  );
}

function TransfersTable({
  transfers,
  isLoading,
  showBranchColumn,
  canReview,
  onChanged,
}: {
  transfers: RevenueShare[];
  isLoading: boolean;
  showBranchColumn: boolean;
  canReview: boolean;
  onChanged: () => void;
}) {
  const [actingId, setActingId] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "ACCEPTED" | "DISPUTED"; note?: string }) =>
      reviewRevenueShare(id, decision, note),
    onSuccess: onChanged,
    onSettled: () => setActingId(null),
  });

  const handleAccept = (t: RevenueShare) => {
    setActingId(t.id);
    reviewMutation.mutate({ id: t.id, decision: "ACCEPTED" });
  };

  const handleDispute = (t: RevenueShare) => {
    const note = window.prompt(
      `What's wrong with this ${formatINR(t.shareAmount)} transfer from ${t.fromBranch.name} to ${t.toBranch.name}?`,
      t.disputeNote ?? "",
    );
    if (note === null) return;
    if (!note.trim()) {
      window.alert("A note is required to flag a transfer as disputed.");
      return;
    }
    setActingId(t.id);
    reviewMutation.mutate({ id: t.id, decision: "DISPUTED", note: note.trim() });
  };

  const colSpan = (showBranchColumn ? 6 : 5) + (canReview ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Transfer date</th>
            <th className="px-4 py-3">Student</th>
            {showBranchColumn && <th className="px-4 py-3">From → To</th>}
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Settled by</th>
            <th className="px-4 py-3">Review status</th>
            {canReview && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && <TableLoadingRow colSpan={colSpan} />}
          {transfers.map((t) => {
            const isActing = actingId === t.id && reviewMutation.isPending;
            return (
              <tr key={t.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(t.transferDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{t.payment.student.name}</td>
                {showBranchColumn && (
                  <td className="px-4 py-3 text-slate-500">
                    {t.fromBranch.name} → {t.toBranch.name}
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-slate-800">{formatINR(t.shareAmount)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {t.settledBy?.name ?? "—"}
                  {/* Purely a record of when the money actually moved — never used to decide
                      which month this transfer's revenue counts toward, that's Transfer date. */}
                  {t.settledAt && <div className="text-slate-400">Settled {new Date(t.settledAt).toLocaleDateString()}</div>}
                  {t.settlementNote && <div className="text-slate-400">{t.settlementNote}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STYLES[t.reviewStatus]}`}>
                      {REVIEW_LABELS[t.reviewStatus]}
                    </span>
                    {t.reviewStatus !== "UNREVIEWED" && t.reviewedBy && (
                      <span className="text-xs text-slate-400">by {t.reviewedBy.name}</span>
                    )}
                    {t.reviewStatus === "DISPUTED" && t.disputeNote && <span className="text-xs text-red-500">{t.disputeNote}</span>}
                  </div>
                </td>
                {canReview && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {t.reviewStatus !== "ACCEPTED" && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleAccept(t)}
                          className="text-xs font-medium text-green-700 hover:underline disabled:opacity-60"
                        >
                          Accept
                        </button>
                      )}
                      {t.reviewStatus !== "DISPUTED" && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleDispute(t)}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                        >
                          Flag disputed
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {!isLoading && transfers.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400">
                No completed transfers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
