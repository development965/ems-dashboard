import { z } from "zod";

/** Exactly one of splitPercent / shareAmount — percent is computed against the payment's
 * amount server-side, a direct amount is used as-is. Whoever records the share picks
 * whichever is easier for that case (there's no fixed company-wide split rule). */
export const createRevenueShareSchema = z
  .object({
    paymentId: z.string().cuid(),
    toBranchId: z.string().cuid(),
    splitPercent: z.coerce.number().positive().max(100).optional(),
    shareAmount: z.coerce.number().positive().max(10_000_000).optional(),
    note: z.string().max(1000).optional(),
    // The date this transfer is *for* — defaults to today when omitted. This, not settledAt,
    // is what revenue reports use to decide which month's collection it counts toward.
    transferDate: z.coerce.date().optional(),
  })
  .refine((v) => (v.splitPercent === undefined) !== (v.shareAmount === undefined), {
    message: "Provide exactly one of splitPercent or shareAmount",
  });

export const settleRevenueShareSchema = z.object({
  settlementNote: z.string().max(1000).optional(),
});

/** Either role can accept or dispute a settled transfer — one confirmation is enough, not
 * a dual sign-off from both. A note is required for a dispute (there has to be a reason)
 * and optional for an acceptance. */
export const reviewRevenueShareSchema = z
  .object({
    decision: z.enum(["ACCEPTED", "DISPUTED"]),
    note: z.string().max(1000).optional(),
  })
  .refine((v) => v.decision !== "DISPUTED" || (v.note && v.note.trim().length > 0), {
    message: "A note is required when flagging a transfer as disputed",
    path: ["note"],
  });

export const revenueShareFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(["PENDING", "SETTLED"]).optional(),
  reviewStatus: z.enum(["UNREVIEWED", "ACCEPTED", "DISPUTED"]).optional(),
});

export type CreateRevenueShareInput = z.infer<typeof createRevenueShareSchema>;
export type SettleRevenueShareInput = z.infer<typeof settleRevenueShareSchema>;
export type ReviewRevenueShareInput = z.infer<typeof reviewRevenueShareSchema>;
export type RevenueShareFilters = z.infer<typeof revenueShareFiltersSchema>;
