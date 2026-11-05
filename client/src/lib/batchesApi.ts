import { api } from "@/lib/api";
import type { Batch, CreateBatchInput } from "@/types/batch";

export async function fetchBatches(courseId?: string): Promise<Batch[]> {
  const { data } = await api.get<{ batches: Batch[] }>("/batches", { params: courseId ? { courseId } : undefined });
  return data.batches;
}

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const { data } = await api.post<{ batch: Batch }>("/batches", input);
  return data.batch;
}
