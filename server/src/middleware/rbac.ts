import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/utils/AppError.js";

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}

/** Roles that see every branch in the company, rather than being pinned to one. */
const COMPANY_WIDE_ROLES: Role[] = ["SUPER_ADMIN", "ACCOUNTANT"];

export function isCompanyWideRole(role: Role): boolean {
  return COMPANY_WIDE_ROLES.includes(role);
}

/**
 * Data-scoping filter for branch-owned resources.
 * SUPER_ADMIN and ACCOUNTANT see every branch within their company (accountants are a
 * company-wide finance role, not tied to one branch's books).
 * BRANCH_ADMIN is restricted to their own branch.
 * Always combine with a companyId filter as well.
 */
export function branchScopeFilter(user: { role: Role; branchId: string | null }): { branchId?: string } {
  if (isCompanyWideRole(user.role)) return {};
  if (!user.branchId) throw new ForbiddenError("User has no branch assigned");
  return { branchId: user.branchId };
}

/**
 * Resolves which branch a new branch-owned record (student, batch) should be created under.
 * Company-wide roles must specify one explicitly — there's no implicit "home branch" to fall
 * back to when you can see all of them. Branch admins are pinned to their own branch.
 */
export function resolveTargetBranchId(user: { role: Role; branchId: string | null }, requestedBranchId?: string): string {
  if (isCompanyWideRole(user.role)) {
    if (!requestedBranchId) throw new ForbiddenError("branchId is required for this role");
    return requestedBranchId;
  }
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenError("Cannot manage records for another branch");
  }
  return user.branchId!;
}
