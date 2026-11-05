import { prisma } from "@/config/prisma.js";
import type { AuthUser } from "@/types/express.js";
import type { AuditFilters } from "@/modules/audit/audit.schema.js";

/** Company-wide, Super Admin only — no branch scoping beyond the optional filter. */
export async function listAuditLogs(user: AuthUser, filters: AuditFilters) {
  const dateRange =
    filters.from || filters.to
      ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) }
      : undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      companyId: user.companyId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(dateRange ? { createdAt: dateRange } : {}),
    },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });

  return logs;
}

/** Distinct action/entityType values seen so far — powers the filter dropdowns. */
export async function listAuditActions(user: AuthUser) {
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({ where: { companyId: user.companyId }, select: { action: true }, distinct: ["action"] }),
    prisma.auditLog.findMany({
      where: { companyId: user.companyId },
      select: { entityType: true },
      distinct: ["entityType"],
    }),
  ]);
  return {
    actions: actions.map((a) => a.action).sort(),
    entityTypes: entityTypes.map((e) => e.entityType).sort(),
  };
}
