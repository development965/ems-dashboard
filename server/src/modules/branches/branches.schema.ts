import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
  // Purely an organizational grouping for dashboard reporting — nullable to allow unassigning.
  zone: z.enum(["ZONE_1", "ZONE_2", "ZONE_3"]).nullable().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
