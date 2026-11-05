import { z } from "zod";

const leadSource = z.enum(["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "OTHER"]);
const leadStatus = z.enum(["NEW", "CONTACTED", "INTERESTED", "TRIAL_SCHEDULED", "CONVERTED", "LOST"]);

export const createLeadSchema = z.object({
  name: z.string().min(2).max(160),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  source: leadSource.default("OTHER"),
  sourceDetail: z.string().max(200).optional(),
  interestedCourseId: z.string().cuid().optional(),
  followUpAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  // Only super admins may target a branch other than their own; see leads.service.ts.
  branchId: z.string().cuid().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().optional(),
  source: leadSource.optional(),
  sourceDetail: z.string().max(200).optional(),
  interestedCourseId: z.string().cuid().nullable().optional(),
  status: leadStatus.optional(),
  followUpAt: z.coerce.date().nullable().optional(),
  lostReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const addLeadActivitySchema = z.object({
  note: z.string().min(1).max(2000),
});

export const convertLeadSchema = z.object({
  courseId: z.string().cuid(),
  batchId: z.string().cuid().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  totalFee: z.coerce.number().nonnegative().max(10_000_000),
  location: z.string().min(1).max(160),
});

export const leadFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  status: leadStatus.optional(),
  source: leadSource.optional(),
  search: z.string().max(160).optional(),
  // Range on `createdAt` — when the lead was generated.
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const leadFunnelFiltersSchema = z.object({
  branchId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type AddLeadActivityInput = z.infer<typeof addLeadActivitySchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
export type LeadFunnelFilters = z.infer<typeof leadFunnelFiltersSchema>;
