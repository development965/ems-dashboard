import { api } from "@/lib/api";
import type { CreateRevenueShareInput, RevenueShare, RevenueShareStatus, TransferReviewStatus } from "@/types/revenueShare";

export async function fetchRevenueShareBranches(): Promise<{ id: string; name: string }[]> {
  const { data } = await api.get<{ branches: { id: string; name: string }[] }>("/revenue-shares/branches");
  return data.branches;
}

export async function fetchRevenueShares(filters: {
  branchId?: string;
  status?: RevenueShareStatus;
  reviewStatus?: TransferReviewStatus;
}): Promise<RevenueShare[]> {
  const { data } = await api.get<{ shares: RevenueShare[] }>("/revenue-shares", {
    params: {
      branchId: filters.branchId || undefined,
      status: filters.status || undefined,
      reviewStatus: filters.reviewStatus || undefined,
    },
  });
  return data.shares;
}

export async function createRevenueShare(input: CreateRevenueShareInput): Promise<RevenueShare> {
  const { data } = await api.post<{ share: RevenueShare }>("/revenue-shares", input);
  return data.share;
}

export async function settleRevenueShare(id: string, settlementNote?: string): Promise<RevenueShare> {
  const { data } = await api.post<{ share: RevenueShare }>(`/revenue-shares/${id}/settle`, { settlementNote });
  return data.share;
}

export async function reviewRevenueShare(id: string, decision: "ACCEPTED" | "DISPUTED", note?: string): Promise<RevenueShare> {
  const { data } = await api.post<{ share: RevenueShare }>(`/revenue-shares/${id}/review`, { decision, note });
  return data.share;
}

export async function deleteRevenueShare(id: string): Promise<void> {
  await api.delete(`/revenue-shares/${id}`);
}
