import { z } from "zod";

export const createUserSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    role: z.enum(["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"]),
    branchId: z.string().cuid().optional(),
  })
  .refine((data) => data.role !== "BRANCH_ADMIN" || Boolean(data.branchId), {
    // Accountants are company-wide (see every branch), so unlike branch admins they don't need one.
    message: "branchId is required for the BRANCH_ADMIN role",
    path: ["branchId"],
  });

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"]).optional(),
  branchId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
