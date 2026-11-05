import { z } from "zod";

export const auditFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  action: z.string().max(80).optional(),
  entityType: z.string().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;
