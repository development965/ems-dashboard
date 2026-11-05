import { z } from "zod";

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(160).optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
