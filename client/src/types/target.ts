export interface BranchTargetRow {
  branchId: string;
  branchName: string;
  targetAmount: number | null;
  actual: number;
  achievedPct: number | null;
}

export interface TargetsReport {
  year: number;
  month: number;
  branches: BranchTargetRow[];
  totals: { target: number; actual: number };
}
