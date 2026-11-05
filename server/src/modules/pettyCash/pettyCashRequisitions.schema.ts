import { z } from "zod";

export const createPettyCashRequisitionSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  reason: z.string().max(1000).optional(),
  branchId: z.string().cuid().optional(),
});

export const decideRequisitionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(1000).optional(),
});

export const requisitionFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED"]).optional(),
});

export type CreatePettyCashRequisitionInput = z.infer<typeof createPettyCashRequisitionSchema>;
export type DecideRequisitionInput = z.infer<typeof decideRequisitionSchema>;
export type RequisitionFilters = z.infer<typeof requisitionFiltersSchema>;
