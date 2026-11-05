import { prisma } from "@/config/prisma.js";
import type { AuthUser } from "@/types/express.js";

interface LogAuditParams {
  actor: AuthUser;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit trail write. Failures are logged but never thrown — an audit
 * write must never be the reason a real user-facing action (payment, discount, etc.) fails.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const actorUser = await prisma.user.findUnique({ where: { id: params.actor.id }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        companyId: params.actor.companyId,
        branchId: params.branchId ?? null,
        actorId: params.actor.id,
        actorName: actorUser?.name ?? "Unknown",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        summary: params.summary,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
