import { prisma } from "@/config/prisma.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import type { AuthUser } from "@/types/express.js";
import { resolveTargetBranchId } from "@/middleware/rbac.js";
import { resolveBranchFilter } from "@/modules/pettyCash/pettyCash.service.js";
import type {
  CreatePettyCashRequisitionInput,
  DecideRequisitionInput,
  RequisitionFilters,
} from "@/modules/pettyCash/pettyCashRequisitions.schema.js";

const includeForList = {
  branch: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  decisionBy: { select: { id: true, name: true } },
  fulfilledBy: { select: { id: true, name: true } },
};

function serialize<T extends { amount: unknown }>(requisition: T) {
  return { ...requisition, amount: toMoney(requisition.amount as never) };
}

export async function listRequisitions(user: AuthUser, filters: RequisitionFilters) {
  const branchFilter = resolveBranchFilter(user, filters.branchId);

  const requisitions = await prisma.pettyCashRequisition.findMany({
    where: {
      companyId: user.companyId,
      ...branchFilter,
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: includeForList,
    orderBy: { createdAt: "desc" },
  });

  return requisitions.map(serialize);
}

/** Branch-level ask for HQ funds — the requester is always pinned to their own branch;
 * only a company-wide role could target another branch, and even then, only deliberately. */
export async function createRequisition(user: AuthUser, input: CreatePettyCashRequisitionInput) {
  const branchId = resolveTargetBranchId(user, input.branchId);

  const requisition = await prisma.pettyCashRequisition.create({
    data: {
      companyId: user.companyId,
      branchId,
      amount: input.amount,
      reason: input.reason,
      requestedById: user.id,
    },
    include: includeForList,
  });

  await logAudit({
    actor: user,
    branchId,
    action: "pettyCashRequisition.created",
    entityType: "PettyCashRequisition",
    entityId: requisition.id,
    summary: `Requested ₹${toMoney(requisition.amount)} petty cash top-up for ${requisition.branch.name}`,
  });

  return serialize(requisition);
}

/** Super-admin-only — the sole approval gate before a requisition can ever be fulfilled. */
export async function decideRequisition(user: AuthUser, requisitionId: string, input: DecideRequisitionInput) {
  const requisition = await prisma.pettyCashRequisition.findFirst({
    where: { id: requisitionId, companyId: user.companyId },
    include: includeForList,
  });
  if (!requisition) throw new NotFoundError("Petty cash requisition not found");
  if (requisition.status !== "PENDING") {
    throw new ConflictError(`This requisition has already been ${requisition.status.toLowerCase()}`);
  }

  const updated = await prisma.pettyCashRequisition.update({
    where: { id: requisition.id },
    data: {
      status: input.decision,
      decisionById: user.id,
      decisionAt: new Date(),
      decisionNotes: input.notes,
    },
    include: includeForList,
  });

  await logAudit({
    actor: user,
    branchId: requisition.branchId,
    action: input.decision === "APPROVED" ? "pettyCashRequisition.approved" : "pettyCashRequisition.rejected",
    entityType: "PettyCashRequisition",
    entityId: requisition.id,
    summary:
      input.decision === "APPROVED"
        ? `Approved a ₹${toMoney(requisition.amount)} petty cash requisition for ${requisition.branch.name} — forwarded to accounts for top-up`
        : `Rejected a ₹${toMoney(requisition.amount)} petty cash requisition for ${requisition.branch.name}`,
  });

  return serialize(updated);
}

/** Accountant (or super admin) executes an approved requisition: creates the actual
 * top-up entry and links it back, atomically, so a requisition can never end up
 * "fulfilled" without a matching cash-box entry or vice versa. */
export async function fulfillRequisition(user: AuthUser, requisitionId: string) {
  const requisition = await prisma.pettyCashRequisition.findFirst({
    where: { id: requisitionId, companyId: user.companyId },
    include: includeForList,
  });
  if (!requisition) throw new NotFoundError("Petty cash requisition not found");
  if (requisition.status !== "APPROVED") {
    throw new ConflictError("Only an approved requisition can be topped up");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.pettyCashEntry.create({
      data: {
        companyId: requisition.companyId,
        branchId: requisition.branchId,
        type: "TOP_UP",
        amount: requisition.amount,
        description: `Top-up for requisition approved by ${requisition.decisionBy?.name ?? "Super Admin"}${requisition.reason ? ` — ${requisition.reason}` : ""}`,
        recordedById: user.id,
      },
    });

    return tx.pettyCashRequisition.update({
      where: { id: requisition.id },
      data: {
        status: "FULFILLED",
        fulfilledById: user.id,
        fulfilledAt: new Date(),
        pettyCashEntryId: entry.id,
      },
      include: includeForList,
    });
  });

  await logAudit({
    actor: user,
    branchId: requisition.branchId,
    action: "pettyCashRequisition.fulfilled",
    entityType: "PettyCashRequisition",
    entityId: requisition.id,
    summary: `Topped up ₹${toMoney(requisition.amount)} petty cash for ${requisition.branch.name}, fulfilling an approved requisition`,
  });

  return serialize(updated);
}
