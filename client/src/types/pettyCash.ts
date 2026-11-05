export type PettyCashType = "TOP_UP" | "EXPENSE";

export interface PettyCashEntry {
  id: string;
  branchId: string;
  type: PettyCashType;
  amount: number;
  category: string | null;
  description: string | null;
  receiptUrl: string | null;
  occurredAt: string;
  createdAt: string;
  branch: { id: string; name: string };
  recordedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
}

export interface PettyCashBranchBalance {
  branchId: string;
  branchName: string;
  topUps: number;
  expenses: number;
  balance: number;
}

export interface PettyCashBalances {
  branches: PettyCashBranchBalance[];
  totals: { topUps: number; expenses: number; balance: number };
}

export interface CreatePettyCashEntryInput {
  type: PettyCashType;
  amount: number;
  category?: string;
  description?: string;
  occurredAt?: string;
  branchId?: string;
}
