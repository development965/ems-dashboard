import { z } from "zod";

export const createBatchSchema = z.object({
  courseId: z.string().cuid(),
  name: z.string().min(1).max(80),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  schedule: z.string().min(2).max(160),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  capacity: z.coerce.number().int().positive().max(1000).optional(),
  // Only super admins may target a branch other than their own; see batches.service.ts.
  branchId: z.string().cuid().optional(),
});

export const updateBatchSchema = createBatchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
