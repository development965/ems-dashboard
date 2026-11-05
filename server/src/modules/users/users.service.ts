import { prisma } from "@/config/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/utils/AppError.js";
import { comparePassword, hashPassword } from "@/utils/password.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter } from "@/middleware/rbac.js";
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from "@/modules/users/users.schema.js";

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function listUsers(user: AuthUser) {
  return prisma.user.findMany({
    where: { companyId: user.companyId, ...branchScopeFilter(user) },
    select: publicSelect,
    orderBy: { name: "asc" },
  });
}

export async function getUser(user: AuthUser, userId: string) {
  const found = await prisma.user.findFirst({
    where: { id: userId, companyId: user.companyId, ...branchScopeFilter(user) },
    select: publicSelect,
  });
  if (!found) throw new NotFoundError("User not found");
  return found;
}

export async function createUser(actor: AuthUser, input: CreateUserInput) {
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId: actor.companyId } });
    if (!branch) throw new NotFoundError("Branch not found");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("Email is already in use");

  const passwordHash = await hashPassword(input.password);

  const created = await prisma.user.create({
    data: {
      companyId: actor.companyId,
      name: input.name,
      email: input.email,
      role: input.role,
      branchId: input.role === "SUPER_ADMIN" ? null : (input.branchId ?? null),
      passwordHash,
    },
    select: publicSelect,
  });

  await logAudit({
    actor,
    branchId: created.branchId,
    action: "user.create",
    entityType: "User",
    entityId: created.id,
    summary: `Created ${created.role} account for ${created.name} (${created.email})`,
  });

  return created;
}

export async function updateUser(actor: AuthUser, userId: string, input: UpdateUserInput) {
  const target = await prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId } });
  if (!target) throw new NotFoundError("User not found");

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId: actor.companyId } });
    if (!branch) throw new NotFoundError("Branch not found");
  }

  const nextRole = input.role ?? target.role;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      branchId: nextRole === "SUPER_ADMIN" ? null : (input.branchId ?? target.branchId),
    },
    select: publicSelect,
  });

  if (input.role !== undefined && input.role !== target.role) {
    await logAudit({
      actor,
      branchId: updated.branchId,
      action: "user.role_changed",
      entityType: "User",
      entityId: updated.id,
      summary: `Changed ${updated.name}'s role from ${target.role} to ${updated.role}`,
    });
  }
  if (input.isActive !== undefined && input.isActive !== target.isActive) {
    await logAudit({
      actor,
      branchId: updated.branchId,
      action: input.isActive ? "user.activated" : "user.deactivated",
      entityType: "User",
      entityId: updated.id,
      summary: `${input.isActive ? "Activated" : "Deactivated"} ${updated.name}'s account`,
    });
  }

  return updated;
}

/** Super-admin-only override — sets a new password without knowing the old one
 * (e.g. an admin locked out or a branch that lost its shared login). */
export async function resetUserPassword(actor: AuthUser, userId: string, input: ResetPasswordInput) {
  const target = await prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId } });
  if (!target) throw new NotFoundError("User not found");

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logAudit({
    actor,
    branchId: target.branchId,
    action: "user.password_reset",
    entityType: "User",
    entityId: target.id,
    summary: `Reset ${target.name}'s password`,
  });
}

/** Hard delete — only succeeds for accounts with no history (never enrolled a student,
 * recorded a payment, approved a discount, etc). Anything with real activity should be
 * deactivated instead, so its audit/payment/discount trail stays intact and attributable. */
export async function deleteUser(actor: AuthUser, userId: string) {
  const target = await prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId } });
  if (!target) throw new NotFoundError("User not found");

  if (target.id === actor.id) {
    throw new ConflictError("You can't delete your own account.");
  }

  if (target.role === "SUPER_ADMIN") {
    const activeSuperAdmins = await prisma.user.count({
      where: { companyId: actor.companyId, role: "SUPER_ADMIN", isActive: true },
    });
    if (activeSuperAdmins <= 1) {
      throw new ConflictError("Can't delete the last active super admin — promote another account first.");
    }
  }

  const [students, payments, discounts, paymentLinks, auditLogs, feeReminders, branchTargets] = await Promise.all([
    prisma.student.count({ where: { createdById: userId } }),
    prisma.payment.count({ where: { recordedById: userId } }),
    prisma.discount.count({ where: { approvedById: userId } }),
    prisma.paymentLink.count({ where: { createdById: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.feeReminder.count({ where: { sentById: userId } }),
    prisma.branchTarget.count({ where: { setById: userId } }),
  ]);
  const totalActivity = students + payments + discounts + paymentLinks + auditLogs + feeReminders + branchTargets;

  if (totalActivity > 0) {
    throw new ConflictError(
      `Can't delete ${target.name} — this account has ${totalActivity} associated record${totalActivity === 1 ? "" : "s"} (enrollments, payments, discounts, etc). Deactivate it instead to preserve that history.`,
    );
  }

  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    actor,
    branchId: target.branchId,
    action: "user.delete",
    entityType: "User",
    entityId: userId,
    summary: `Deleted ${target.role} account for ${target.name} (${target.email})`,
  });
}

export async function changeOwnPassword(actor: AuthUser, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new UnauthorizedError();

  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) throw new ForbiddenError("Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash } });
}
