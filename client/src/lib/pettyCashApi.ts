import { api } from "@/lib/api";
import type { CreatePettyCashEntryInput, PettyCashBalances, PettyCashEntry, PettyCashType } from "@/types/pettyCash";

/** `<input type="date">` gives "YYYY-MM-DD" in local time — construct explicitly rather than
 * `new Date(str)` (which parses as UTC midnight) to avoid an off-by-one-day near midnight. */
function toStartOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}
function toEndOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export async function fetchPettyCashEntries(filters: {
  branchId?: string;
  from?: string;
  to?: string;
  type?: PettyCashType;
  reviewed?: "true" | "false";
}): Promise<PettyCashEntry[]> {
  const { data } = await api.get<{ entries: PettyCashEntry[] }>("/petty-cash", {
    params: {
      branchId: filters.branchId || undefined,
      type: filters.type || undefined,
      reviewed: filters.reviewed || undefined,
      from: filters.from ? toStartOfDayIso(filters.from) : undefined,
      to: filters.to ? toEndOfDayIso(filters.to) : undefined,
    },
  });
  return data.entries;
}

export async function fetchPettyCashBalances(branchId?: string): Promise<PettyCashBalances> {
  const { data } = await api.get<PettyCashBalances>("/petty-cash/balances", { params: branchId ? { branchId } : undefined });
  return data;
}

export async function createPettyCashEntry(input: CreatePettyCashEntryInput, receipt?: File): Promise<PettyCashEntry> {
  const formData = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) formData.append(key, String(value));
  });
  if (receipt) formData.append("receipt", receipt);
  const { data } = await api.post<{ entry: PettyCashEntry }>("/petty-cash", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.entry;
}

export async function deletePettyCashEntry(id: string): Promise<void> {
  await api.delete(`/petty-cash/${id}`);
}

export async function uploadPettyCashReceipt(id: string, file: File): Promise<PettyCashEntry> {
  const formData = new FormData();
  formData.append("receipt", file);
  const { data } = await api.post<{ entry: PettyCashEntry }>(`/petty-cash/${id}/receipt`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.entry;
}

export async function reviewPettyCashEntry(id: string): Promise<PettyCashEntry> {
  const { data } = await api.post<{ entry: PettyCashEntry }>(`/petty-cash/${id}/review`, {});
  return data.entry;
}

export async function unreviewPettyCashEntry(id: string): Promise<PettyCashEntry> {
  const { data } = await api.delete<{ entry: PettyCashEntry }>(`/petty-cash/${id}/review`);
  return data.entry;
}
