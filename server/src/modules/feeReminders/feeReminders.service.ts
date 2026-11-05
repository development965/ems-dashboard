import { prisma } from "@/config/prisma.js";
import { NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, isCompanyWideRole } from "@/middleware/rbac.js";
import { inScopeFilter } from "@/config/scope.js";
import type { CreateFeeReminderInput } from "@/modules/feeReminders/feeReminders.schema.js";

function resolveBranchFilter(user: AuthUser, branchId?: string) {
  if (!isCompanyWideRole(user.role)) return branchScopeFilter(user);
  return branchId ? { branchId } : {};
}

/** Students with a balance due, plus when they were last chased so staff can prioritize. */
export async function listStudentsNeedingReminders(user: AuthUser, branchId?: string) {
  const branchFilter = resolveBranchFilter(user, branchId);

  const students = await prisma.student.findMany({
    where: { companyId: user.companyId, ...branchFilter, ...inScopeFilter, status: { not: "DROPPED" } },
    select: {
      id: true,
      name: true,
      phone: true,
      totalFee: true,
      createdAt: true,
      branch: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
      discounts: { select: { amount: true } },
      feeReminders: { select: { channel: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const rows = students
    .map((s) => {
      const paid = s.payments.reduce((sum, p) => sum + toMoney(p.amount), 0);
      const discount = s.discounts.reduce((sum, d) => sum + toMoney(d.amount), 0);
      const netFee = Math.max(toMoney(s.totalFee) - discount, 0);
      const balanceDue = Math.max(netFee - paid, 0);
      const lastReminder = s.feeReminders[0];
      return {
        studentId: s.id,
        studentName: s.name,
        phone: s.phone,
        branchId: s.branch.id,
        branchName: s.branch.name,
        courseName: s.course.name,
        balanceDue,
        enrolledAt: s.createdAt,
        lastReminderAt: lastReminder?.createdAt ?? null,
        lastReminderChannel: lastReminder?.channel ?? null,
      };
    })
    .filter((r) => r.balanceDue > 0)
    // Never-reminded students first, then longest-since-last-reminder.
    .sort((a, b) => {
      const aTime = a.lastReminderAt ? new Date(a.lastReminderAt).getTime() : -Infinity;
      const bTime = b.lastReminderAt ? new Date(b.lastReminderAt).getTime() : -Infinity;
      return aTime - bTime;
    });

  return rows;
}

export async function createFeeReminder(user: AuthUser, input: CreateFeeReminderInput) {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, companyId: user.companyId, ...branchScopeFilter(user), ...inScopeFilter },
  });
  if (!student) throw new NotFoundError("Student not found");

  const reminder = await prisma.feeReminder.create({
    data: {
      companyId: student.companyId,
      branchId: student.branchId,
      studentId: student.id,
      channel: input.channel,
      notes: input.notes,
      sentById: user.id,
    },
  });

  await logAudit({
    actor: user,
    branchId: student.branchId,
    action: "fee_reminder.sent",
    entityType: "FeeReminder",
    entityId: reminder.id,
    summary: `Sent a ${input.channel} fee reminder to ${student.name}`,
  });

  return reminder;
}

export async function listReminderHistory(user: AuthUser, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, companyId: user.companyId, ...branchScopeFilter(user), ...inScopeFilter },
  });
  if (!student) throw new NotFoundError("Student not found");

  return prisma.feeReminder.findMany({
    where: { studentId },
    include: { sentBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
