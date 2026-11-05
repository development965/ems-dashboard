import { z } from "zod";

const courseMode = z.enum(["ONLINE", "OFFLINE", "HYBRID"]);

export const createCourseSchema = z.object({
  name: z.string().min(2).max(160),
  code: z.string().min(2).max(30),
  description: z.string().max(2000).optional(),
  durationText: z.string().max(80).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createFeeStructureSchema = z.object({
  label: z.string().min(2).max(80),
  mode: courseMode,
  amount: z.coerce.number().positive().max(10_000_000),
  currency: z.string().length(3).default("INR"),
});

export const updateFeeStructureSchema = createFeeStructureSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
