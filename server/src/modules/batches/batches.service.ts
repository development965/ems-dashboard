import { prisma } from "@/config/prisma.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, resolveTargetBranchId } from "@/middleware/rbac.js";
import type { CreateBatchInput, UpdateBatchInput } from "@/modules/batches/batches.schema.js";

export async function listBatches(user: AuthUser, courseId?: string) {
  return prisma.batch.findMany({
    where: { companyId: user.companyId, ...branchScopeFilter(user), ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getBatch(user: AuthUser, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, companyId: user.companyId, ...branchScopeFilter(user) },
    include: { course: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true } } },
  });
  if (!batch) throw new NotFoundError("Batch not found");
  return batch;
}

export async function createBatch(user: AuthUser, input: CreateBatchInput) {
  const branchId = resolveTargetBranchId(user, input.branchId);

  const [branch, course] = await Promise.all([
    prisma.branch.findFirst({ where: { id: branchId, companyId: user.companyId } }),
    prisma.course.findFirst({ where: { id: input.courseId, companyId: user.companyId } }),
  ]);
  if (!branch) throw new NotFoundError("Branch not found");
  if (!course) throw new NotFoundError("Course not found");

  const existing = await prisma.batch.findFirst({ where: { branchId, courseId: input.courseId, name: input.name } });
  if (existing) throw new ConflictError(`A batch named "${input.name}" already exists for this course at this branch`);

  return prisma.batch.create({
    data: {
      companyId: user.companyId,
      branchId,
      courseId: input.courseId,
      name: input.name,
      mode: input.mode,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      capacity: input.capacity,
    },
    include: { course: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true } } },
  });
}

export async function updateBatch(user: AuthUser, batchId: string, input: UpdateBatchInput) {
  await getBatch(user, batchId); // ensures branch scope + existence

  return prisma.batch.update({
    where: { id: batchId },
    data: {
      name: input.name,
      mode: input.mode,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      capacity: input.capacity,
      isActive: input.isActive,
    },
    include: { course: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true } } },
  });
}

export async function deleteBatch(user: AuthUser, batchId: string) {
  await getBatch(user, batchId);
  await prisma.batch.delete({ where: { id: batchId } });
}
