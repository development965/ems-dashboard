import { prisma } from "@/config/prisma.js";
import { ForbiddenError, NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, resolveTargetBranchId } from "@/middleware/rbac.js";
import type { CreateStudentInput, UpdateStudentInput } from "@/modules/students/students.schema.js";
import type { Discount, Payment, Student } from "@prisma/client";
import { inScopeFilter } from "@/config/scope.js";

/**
 * Branch admins enroll students at whatever fee the course catalog already publishes — they
 * can't discount. Only accountants and super admins can set a custom/discounted amount.
 */
async function assertFeeAllowed(user: AuthUser, courseId: string, totalFee: number): Promise<void> {
  if (user.role !== "BRANCH_ADMIN") return;

  const feeStructures = await prisma.courseFeeStructure.findMany({
    where: { courseId, isActive: true },
    select: { amount: true },
  });

  const requestedCents = Math.round(totalFee * 100);
  const matches = feeStructures.some((fee) => Math.round(toMoney(fee.amount) * 100) === requestedCents);

  if (!matches) {
    throw new ForbiddenError(
      "Branch admins can only enroll at a published fee structure amount — ask an accountant or super admin for a custom/discounted fee.",
    );
  }
}

function withBalance(
  student: Student & { payments: Pick<Payment, "amount">[]; discounts: Pick<Discount, "amount">[] },
) {
  const amountPaid = student.payments.reduce((sum, p) => sum + toMoney(p.amount), 0);
  const totalDiscount = student.discounts.reduce((sum, d) => sum + toMoney(d.amount), 0);
  const totalFee = toMoney(student.totalFee);
  const netFee = Math.max(totalFee - totalDiscount, 0);
  return {
    ...student,
    totalFee,
    totalDiscount,
    netFee,
    amountPaid,
    balanceDue: Math.max(netFee - amountPaid, 0),
    placementPackageLPA: student.placementPackageLPA === null ? null : toMoney(student.placementPackageLPA),
    payments: undefined,
    discounts: undefined,
  };
}

const includeForSummary = {
  course: { select: { id: true, name: true, code: true } },
  batch: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  payments: { select: { amount: true } },
  discounts: { select: { amount: true } },
} as const;

export async function listStudents(user: AuthUser, filters: { courseId?: string; status?: string; search?: string }) {
  const students = await prisma.student.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...inScopeFilter,
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search } }, { phone: { contains: filters.search } }] }
        : {}),
    },
    include: includeForSummary,
    orderBy: { createdAt: "desc" },
  });
  return students.map(withBalance);
}

export async function getStudent(user: AuthUser, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, companyId: user.companyId, ...branchScopeFilter(user), ...inScopeFilter },
    include: includeForSummary,
  });
  if (!student) throw new NotFoundError("Student not found");
  return withBalance(student);
}

/** Re-queries fresh (not from a cached list) so payment/discount creation always checks the current balance. */
export async function getStudentBalance(
  studentId: string,
): Promise<{ totalFee: number; totalDiscount: number; netFee: number; amountPaid: number; balanceDue: number }> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { payments: { select: { amount: true } }, discounts: { select: { amount: true } } },
  });
  const amountPaid = student.payments.reduce((sum, p) => sum + toMoney(p.amount), 0);
  const totalDiscount = student.discounts.reduce((sum, d) => sum + toMoney(d.amount), 0);
  const totalFee = toMoney(student.totalFee);
  const netFee = Math.max(totalFee - totalDiscount, 0);
  return { totalFee, totalDiscount, netFee, amountPaid, balanceDue: Math.max(netFee - amountPaid, 0) };
}

export async function createStudent(user: AuthUser, input: CreateStudentInput) {
  const branchId = resolveTargetBranchId(user, input.branchId);

  const [branch, course] = await Promise.all([
    prisma.branch.findFirst({ where: { id: branchId, companyId: user.companyId } }),
    prisma.course.findFirst({ where: { id: input.courseId, companyId: user.companyId } }),
  ]);
  if (!branch) throw new NotFoundError("Branch not found");
  if (!course) throw new NotFoundError("Course not found");

  if (input.batchId) {
    const batch = await prisma.batch.findFirst({ where: { id: input.batchId, branchId, courseId: input.courseId } });
    if (!batch) throw new NotFoundError("Batch not found for this course/branch");
  }

  await assertFeeAllowed(user, input.courseId, input.totalFee);

  const student = await prisma.student.create({
    data: {
      companyId: user.companyId,
      branchId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      location: input.location,
      courseId: input.courseId,
      batchId: input.batchId,
      mode: input.mode,
      totalFee: input.totalFee,
      notes: input.notes,
      createdById: user.id,
    },
    include: includeForSummary,
  });

  await logAudit({
    actor: user,
    branchId: student.branchId,
    action: "student.create",
    entityType: "Student",
    entityId: student.id,
    summary: `Enrolled ${student.name} in ${student.course.name} at ${student.branch.name} (fee ₹${input.totalFee})`,
  });

  return withBalance(student);
}

export async function saveStudentDocuments(
  user: AuthUser,
  studentId: string,
  urls: { photoUrl?: string; idProofUrl?: string },
) {
  await getStudent(user, studentId); // ensures branch scope + existence

  const student = await prisma.student.update({
    where: { id: studentId },
    data: urls,
    include: includeForSummary,
  });
  return withBalance(student);
}

export async function updateStudent(user: AuthUser, studentId: string, input: UpdateStudentInput) {
  const existing = await getStudent(user, studentId);

  if (input.batchId) {
    const batch = await prisma.batch.findFirst({
      where: { id: input.batchId, branchId: existing.branchId, courseId: existing.courseId },
    });
    if (!batch) throw new NotFoundError("Batch not found for this course/branch");
  }

  if (input.totalFee !== undefined && input.totalFee !== existing.totalFee) {
    await assertFeeAllowed(user, existing.courseId, input.totalFee);
  }

  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      location: input.location,
      batchId: input.batchId,
      mode: input.mode,
      totalFee: input.totalFee,
      status: input.status,
      notes: input.notes,
      certificationStatus: input.certificationStatus,
      certificateNo: input.certificateNo,
      certificateIssuedAt: input.certificateIssuedAt,
      placementStatus: input.placementStatus,
      placementCompany: input.placementCompany,
      placementRole: input.placementRole,
      placementPackageLPA: input.placementPackageLPA,
      placedAt: input.placedAt,
    },
    include: includeForSummary,
  });

  if (input.totalFee !== undefined && input.totalFee !== existing.totalFee) {
    await logAudit({
      actor: user,
      branchId: student.branchId,
      action: "student.fee_changed",
      entityType: "Student",
      entityId: student.id,
      summary: `Changed ${student.name}'s total fee from ₹${existing.totalFee} to ₹${input.totalFee}`,
      metadata: { from: existing.totalFee, to: input.totalFee },
    });
  }
  if (input.status !== undefined && input.status !== existing.status) {
    await logAudit({
      actor: user,
      branchId: student.branchId,
      action: "student.status_changed",
      entityType: "Student",
      entityId: student.id,
      summary: `Changed ${student.name}'s status from ${existing.status} to ${input.status}`,
    });
  }
  if (input.certificationStatus !== undefined && input.certificationStatus !== existing.certificationStatus) {
    await logAudit({
      actor: user,
      branchId: student.branchId,
      action: "student.certification_changed",
      entityType: "Student",
      entityId: student.id,
      summary: `Marked ${student.name}'s certification as ${input.certificationStatus}`,
    });
  }
  if (input.placementStatus !== undefined && input.placementStatus !== existing.placementStatus) {
    await logAudit({
      actor: user,
      branchId: student.branchId,
      action: "student.placement_changed",
      entityType: "Student",
      entityId: student.id,
      summary: `Marked ${student.name}'s placement as ${input.placementStatus}${input.placementCompany ? ` at ${input.placementCompany}` : ""}`,
    });
  }

  return withBalance(student);
}
