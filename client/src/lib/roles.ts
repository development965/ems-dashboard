import type { Role } from "@/types/auth";

/** Super admins and accountants see every branch in the company; branch admins see only their own. */
export function canSeeAllBranches(role: Role | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ACCOUNTANT";
}
