import { z } from "zod";

export const reportFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
