import { api } from "@/lib/api";
import type { TargetsReport } from "@/types/target";

export async function fetchTargets(year: number, month: number): Promise<TargetsReport> {
  const { data } = await api.get<TargetsReport>("/targets", { params: { year, month } });
  return data;
}

export async function setTarget(input: {
  branchId: string;
  year: number;
  month: number;
  targetAmount: number;
}): Promise<void> {
  await api.post("/targets", input);
}
