import { prisma } from "@/config/prisma.js";
import { NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import { isCompanyWideRole } from "@/middleware/rbac.js";
import type { AuthUser } from "@/types/express.js";
import { studentInScopeFilter } from "@/config/scope.js";
import type { SetTargetInput } from "@/modules/targets/targets.schema.js";

/** Every branch's target vs actual revenue for one calendar month — full company view for
 * super admins/accountants, scoped to just their own branch for a branch admin (read-only;
 * setting a target stays a super-admin-only capability, enforced in the route). */
export async function listTargets(user: AuthUser, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [branches, targets, revenueAgg] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId: user.companyId, ...(isCompanyWideRole(user.role) ? {} : { id: user.branchId! }) },
      orderBy: { name: "asc" },
    }),
    prisma.branchTarget.findMany({ where: { companyId: user.companyId, year, month } }),
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { companyId: user.companyId, ...studentInScopeFilter, paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const targetByBranch = new Map(targets.map((t) => [t.branchId, t]));
  const revenueByBranch = new Map(revenueAgg.map((r) => [r.branchId, toMoney(r._sum.amount ?? 0)]));

  const rows = branches.map((b) => {
    const target = targetByBranch.get(b.id);
    const targetAmount = target ? toMoney(target.targetAmount) : null;
    const actual = revenueByBranch.get(b.id) ?? 0;
    return {
      branchId: b.id,
      branchName: b.name,
      targetAmount,
      actual,
      achievedPct: targetAmount && targetAmount > 0 ? Math.round((actual / targetAmount) * 1000) / 10 : null,
    };
  });

  return {
    year,
    month,
    branches: rows,
    totals: {
      target: rows.reduce((sum, r) => sum + (r.targetAmount ?? 0), 0),
      actual: rows.reduce((sum, r) => sum + r.actual, 0),
    },
  };
}

export async function setTarget(user: AuthUser, input: SetTargetInput) {
  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId: user.companyId } });
  if (!branch) throw new NotFoundError("Branch not found");

  const target = await prisma.branchTarget.upsert({
    where: { branchId_year_month: { branchId: input.branchId, year: input.year, month: input.month } },
    update: { targetAmount: input.targetAmount, setById: user.id },
    create: {
      companyId: user.companyId,
      branchId: input.branchId,
      year: input.year,
      month: input.month,
      targetAmount: input.targetAmount,
      setById: user.id,
    },
  });

  await logAudit({
    actor: user,
    branchId: branch.id,
    action: "branch_target.set",
    entityType: "BranchTarget",
    entityId: target.id,
    summary: `Set ${branch.name}'s ${input.year}-${String(input.month).padStart(2, "0")} target to ₹${input.targetAmount}`,
  });

  return { ...target, targetAmount: toMoney(target.targetAmount) };
}
