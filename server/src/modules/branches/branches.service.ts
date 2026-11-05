import { prisma } from "@/config/prisma.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter } from "@/middleware/rbac.js";
import type { CreateBranchInput, UpdateBranchInput } from "@/modules/branches/branches.schema.js";

export async function listBranches(user: AuthUser) {
  return prisma.branch.findMany({
    where: { companyId: user.companyId, ...branchScopeFilter(user) },
    orderBy: { name: "asc" },
  });
}

export async function getBranch(user: AuthUser, branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId: user.companyId, ...branchScopeFilter(user) },
  });
  if (!branch) throw new NotFoundError("Branch not found");
  return branch;
}

export async function createBranch(user: AuthUser, input: CreateBranchInput) {
  const existing = await prisma.branch.findFirst({ where: { companyId: user.companyId, code: input.code } });
  if (existing) throw new ConflictError(`Branch code "${input.code}" is already in use`);

  return prisma.branch.create({
    data: { ...input, companyId: user.companyId },
  });
}

export async function updateBranch(user: AuthUser, branchId: string, input: UpdateBranchInput) {
  await getBranch(user, branchId); // ensures branch belongs to this company

  return prisma.branch.update({
    where: { id: branchId },
    data: input,
  });
}

export async function deleteBranch(user: AuthUser, branchId: string) {
  await getBranch(user, branchId);
  await prisma.branch.delete({ where: { id: branchId } });
}
