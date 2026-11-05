export type PettyCashRequisitionStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";

interface RequisitionUserRef {
  id: string;
  name: string;
}

export interface PettyCashRequisition {
  id: string;
  branchId: string;
  amount: number;
  reason: string | null;
  status: PettyCashRequisitionStatus;
  decisionNotes: string | null;
  decisionAt: string | null;
  fulfilledAt: string | null;
  pettyCashEntryId: string | null;
  createdAt: string;
  branch: { id: string; name: string };
  requestedBy: RequisitionUserRef;
  decisionBy: RequisitionUserRef | null;
  fulfilledBy: RequisitionUserRef | null;
}

export interface CreatePettyCashRequisitionInput {
  amount: number;
  reason?: string;
  branchId?: string;
}
