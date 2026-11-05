import { api } from "@/lib/api";
import type { CreatePettyCashRequisitionInput, PettyCashRequisition, PettyCashRequisitionStatus } from "@/types/pettyCashRequisition";

export async function fetchPettyCashRequisitions(filters: {
  branchId?: string;
  status?: PettyCashRequisitionStatus;
}): Promise<PettyCashRequisition[]> {
  const { data } = await api.get<{ requisitions: PettyCashRequisition[] }>("/petty-cash-requisitions", {
    params: { branchId: filters.branchId || undefined, status: filters.status || undefined },
  });
  return data.requisitions;
}

export async function createPettyCashRequisition(input: CreatePettyCashRequisitionInput): Promise<PettyCashRequisition> {
  const { data } = await api.post<{ requisition: PettyCashRequisition }>("/petty-cash-requisitions", input);
  return data.requisition;
}

export async function decidePettyCashRequisition(
  id: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
): Promise<PettyCashRequisition> {
  const { data } = await api.post<{ requisition: PettyCashRequisition }>(`/petty-cash-requisitions/${id}/decision`, { decision, notes });
  return data.requisition;
}

export async function fulfillPettyCashRequisition(id: string): Promise<PettyCashRequisition> {
  const { data } = await api.post<{ requisition: PettyCashRequisition }>(`/petty-cash-requisitions/${id}/fulfill`, {});
  return data.requisition;
}
