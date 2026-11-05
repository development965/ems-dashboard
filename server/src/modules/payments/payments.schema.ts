import { z } from "zod";

export const createPaymentLinkSchema = z.object({
  studentId: z.string().cuid(),
  amount: z.coerce.number().positive().max(10_000_000),
  description: z.string().max(255).optional(),
  expiresInHours: z.coerce.number().int().positive().max(24 * 30).optional(),
});

export const recordManualPaymentSchema = z.object({
  studentId: z.string().cuid(),
  amount: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

// Remarks (e.g. a bank transaction ID) added after the fact, from the Receipts report —
// an empty string clears it, same as leaving it blank when first recording the payment.
export const updatePaymentNotesSchema = z.object({
  notes: z.string().max(1000),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>;
export type UpdatePaymentNotesInput = z.infer<typeof updatePaymentNotesSchema>;
