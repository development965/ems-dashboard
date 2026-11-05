import { z } from "zod";

export const createFeeReminderSchema = z.object({
  studentId: z.string().cuid(),
  channel: z.enum(["WHATSAPP", "CALL", "SMS", "EMAIL", "OTHER"]),
  notes: z.string().max(500).optional(),
});

export type CreateFeeReminderInput = z.infer<typeof createFeeReminderSchema>;
