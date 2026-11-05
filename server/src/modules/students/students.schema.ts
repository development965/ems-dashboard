import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().min(2).max(160),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  location: z.string().min(1).max(160),
  courseId: z.string().cuid(),
  batchId: z.string().cuid().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  totalFee: z.coerce.number().nonnegative().max(10_000_000),
  notes: z.string().max(2000).optional(),
  // Only super admins may target a branch other than their own; see students.service.ts.
  branchId: z.string().cuid().optional(),
});

export const updateStudentSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().optional(),
  location: z.string().min(1).max(160).optional(),
  batchId: z.string().cuid().nullable().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  totalFee: z.coerce.number().nonnegative().max(10_000_000).optional(),
  status: z.enum(["ENROLLED", "COMPLETED", "DROPPED"]).optional(),
  notes: z.string().max(2000).optional(),
  certificationStatus: z.enum(["NOT_ISSUED", "ISSUED"]).optional(),
  certificateNo: z.string().max(80).optional(),
  certificateIssuedAt: z.coerce.date().optional(),
  placementStatus: z.enum(["NOT_PLACED", "IN_PROGRESS", "PLACED"]).optional(),
  placementCompany: z.string().max(160).optional(),
  placementRole: z.string().max(120).optional(),
  placementPackageLPA: z.coerce.number().nonnegative().max(9999).optional(),
  placedAt: z.coerce.date().optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
