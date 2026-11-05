import { z } from "zod";

export const createDiscountSchema = z.object({
  studentId: z.string().cuid(),
  amount: z.coerce.number().positive().max(10_000_000),
  reason: z.string().max(500).optional(),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
