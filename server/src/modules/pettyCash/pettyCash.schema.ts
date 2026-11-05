import { z } from "zod";

export const createPettyCashEntrySchema = z.object({
  type: z.enum(["TOP_UP", "EXPENSE"]),
  amount: z.coerce.number().positive().max(10_000_000),
  category: z.string().max(80).optional(),
  description: z.string().max(1000).optional(),
  occurredAt: z.coerce.date().optional(),
  branchId: z.string().cuid().optional(),
});

export const pettyCashFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(["TOP_UP", "EXPENSE"]).optional(),
  reviewed: z.enum(["true", "false"]).optional(),
});

export type CreatePettyCashEntryInput = z.infer<typeof createPettyCashEntrySchema>;
export type PettyCashFilters = z.infer<typeof pettyCashFiltersSchema>;
