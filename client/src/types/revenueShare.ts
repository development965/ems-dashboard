export type RevenueShareStatus = "PENDING" | "SETTLED";
export type TransferReviewStatus = "UNREVIEWED" | "ACCEPTED" | "DISPUTED";

interface RevenueShareUserRef {
  id: string;
  name: string;
}

export interface RevenueShare {
  id: string;
  paymentId: string;
  fromBranchId: string;
  toBranchId: string;
  splitPercent: number | null;
  shareAmount: number;
  note: string | null;
  // What revenue reports bucket this transfer by — the date it's *for*, not when it was
  // entered or settled. Editable at creation; defaults to that day if left blank.
  transferDate: string;
  status: RevenueShareStatus;
  settlementNote: string | null;
  settledAt: string | null;
  reviewStatus: TransferReviewStatus;
  disputeNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  payment: { id: string; amount: number; paidAt: string; student: { id: string; name: string } };
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  recordedBy: RevenueShareUserRef;
  settledBy: RevenueShareUserRef | null;
  reviewedBy: RevenueShareUserRef | null;
}

export interface CreateRevenueShareInput {
  paymentId: string;
  toBranchId: string;
  splitPercent?: number;
  shareAmount?: number;
  note?: string;
  transferDate?: string;
}
