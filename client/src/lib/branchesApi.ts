import { api } from "@/lib/api";
import type { Branch, CreateBranchInput, UpdateBranchInput } from "@/types/branch";

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get<{ branches: Branch[] }>("/branches");
  return data.branches;
}

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  const { data } = await api.post<{ branch: Branch }>("/branches", input);
  return data.branch;
}

export async function updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
  const { data } = await api.patch<{ branch: Branch }>(`/branches/${id}`, input);
  return data.branch;
}
