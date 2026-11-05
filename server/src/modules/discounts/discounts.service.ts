import { prisma } from "@/config/prisma.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter } from "@/middleware/rbac.js";
import { getStudentBalance } from "@/modules/students/students.service.js";
import { studentInScopeFilter } from "@/config/scope.js";
import type { CreateDiscountInput } from "@/modules/discounts/discounts.schema.js";

export async function listDiscounts(user: AuthUser, studentId?: string) {
  const discounts = await prisma.discount.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...studentInScopeFilter,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { select: { id: true, name: true, phone: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return discounts.map((d) => ({ ...d, amount: toMoney(d.amount) }));
}

/** Capped to the student's current balance due — a discount can't reduce the fee below what's already been collected. */
export async function createDiscount(user: AuthUser, input: CreateDiscountInput) {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, companyId: user.companyId, ...branchScopeFilter(user) },
  });
  if (!student) throw new NotFoundError("Student not found");

  const { balanceDue } = await getStudentBalance(student.id);
  if (balanceDue <= 0) {
    throw new ConflictError("This student has no outstanding balance to discount.");
  }

  const amount = Math.min(input.amount, balanceDue);

  const discount = await prisma.discount.create({
    data: {
      companyId: student.companyId,
      branchId: student.branchId,
      studentId: student.id,
      amount,
      reason: input.reason,
      approvedById: user.id,
    },
    include: {
      student: { select: { id: true, name: true, phone: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actor: user,
    branchId: student.branchId,
    action: "discount.granted",
    entityType: "Discount",
    entityId: discount.id,
    summary: `Granted ₹${toMoney(discount.amount)} discount to ${student.name}${input.reason ? ` (${input.reason})` : ""}`,
  });

  return { ...discount, amount: toMoney(discount.amount) };
}
