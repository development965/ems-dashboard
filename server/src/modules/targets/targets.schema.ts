import { z } from "zod";

export const targetFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const setTargetSchema = z.object({
  branchId: z.string().cuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  targetAmount: z.coerce.number().nonnegative().max(1_000_000_000),
});

export type TargetFilters = z.infer<typeof targetFiltersSchema>;
export type SetTargetInput = z.infer<typeof setTargetSchema>;
