import { prisma } from "@/config/prisma.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import { ForbiddenError, NotFoundError } from "@/utils/AppError.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, isCompanyWideRole, resolveTargetBranchId } from "@/middleware/rbac.js";
import type { CreatePettyCashEntryInput, PettyCashFilters } from "@/modules/pettyCash/pettyCash.schema.js";

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

/** A branch-scoped user must never widen their own view via a client-supplied `branchId` —
 * only company-wide roles may look at a branch other than their own. */
export function resolveBranchFilter(user: AuthUser, requestedBranchId?: string): { branchId?: string } {
  if (isCompanyWideRole(user.role)) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenError("Cannot view another branch's petty cash");
  }
  return branchScopeFilter(user);
}

export async function listEntries(user: AuthUser, filters: PettyCashFilters) {
  const branchFilter = resolveBranchFilter(user, filters.branchId);
  const occurredAtRange = dateRange(filters.from, filters.to);

  const entries = await prisma.pettyCashEntry.findMany({
    where: {
      companyId: user.companyId,
      ...branchFilter,
      ...(filters.type ? { type: filters.type } : {}),
      ...(occurredAtRange ? { occurredAt: occurredAtRange } : {}),
      ...(filters.reviewed === "true" ? { reviewedAt: { not: null } } : {}),
      ...(filters.reviewed === "false" ? { reviewedAt: null } : {}),
    },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return entries.map((e) => ({ ...e, amount: toMoney(e.amount) }));
}

/** Always all-time, regardless of any date filter elsewhere — a cash-in-hand balance has to
 * reflect the real, current position, not a period-scoped one. */
export async function getBalances(user: AuthUser, branchId?: string) {
  const scopeFilter = resolveBranchFilter(user, branchId);

  const [branches, sums] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId: user.companyId, ...(scopeFilter.branchId ? { id: scopeFilter.branchId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pettyCashEntry.groupBy({
      by: ["branchId", "type"],
      where: { companyId: user.companyId, ...scopeFilter },
      _sum: { amount: true },
    }),
  ]);

  const sumFor = (bId: string, type: "TOP_UP" | "EXPENSE") =>
    toMoney(sums.find((s) => s.branchId === bId && s.type === type)?._sum.amount ?? 0);

  const rows = branches.map((b) => {
    const topUps = sumFor(b.id, "TOP_UP");
    const expenses = sumFor(b.id, "EXPENSE");
    return { branchId: b.id, branchName: b.name, topUps, expenses, balance: topUps - expenses };
  });

  return {
    branches: rows,
    totals: {
      topUps: rows.reduce((sum, r) => sum + r.topUps, 0),
      expenses: rows.reduce((sum, r) => sum + r.expenses, 0),
      balance: rows.reduce((sum, r) => sum + r.balance, 0),
    },
  };
}

/** Split by type: a branch raises its own expenses, only the super admin injects a top-up
 * directly (top-ups otherwise only happen via an approved requisition being fulfilled). */
export async function createEntry(user: AuthUser, input: CreatePettyCashEntryInput, receiptUrl?: string) {
  if (input.type === "TOP_UP" && user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Only the super admin can record a top-up directly");
  }

  const branchId = resolveTargetBranchId(user, input.branchId);

  const entry = await prisma.pettyCashEntry.create({
    data: {
      companyId: user.companyId,
      branchId,
      type: input.type,
      amount: input.amount,
      category: input.type === "EXPENSE" ? input.category : undefined,
      description: input.description,
      receiptUrl,
      occurredAt: input.occurredAt ?? new Date(),
      recordedById: user.id,
    },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actor: user,
    branchId,
    action: input.type === "TOP_UP" ? "pettyCash.topUp" : "pettyCash.expense",
    entityType: "PettyCashEntry",
    entityId: entry.id,
    summary:
      input.type === "TOP_UP"
        ? `Topped up ₹${toMoney(entry.amount)} petty cash for ${entry.branch.name}`
        : `Recorded ₹${toMoney(entry.amount)} petty cash expense (${input.category ?? "uncategorized"}) for ${entry.branch.name}`,
  });

  return { ...entry, amount: toMoney(entry.amount) };
}

/** Whoever recorded an entry (or any company-wide role) can attach its bill/receipt —
 * scoped the same way as viewing, so a branch admin can't touch another branch's entry. */
export async function attachReceipt(user: AuthUser, entryId: string, receiptUrl: string) {
  const entry = await prisma.pettyCashEntry.findFirst({
    where: { id: entryId, companyId: user.companyId },
    include: { branch: { select: { name: true } } },
  });
  if (!entry) throw new NotFoundError("Petty cash entry not found");
  if (!isCompanyWideRole(user.role) && entry.branchId !== user.branchId) {
    throw new ForbiddenError("Cannot attach a receipt to another branch's entry");
  }

  const updated = await prisma.pettyCashEntry.update({
    where: { id: entry.id },
    data: { receiptUrl },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actor: user,
    branchId: entry.branchId,
    action: "pettyCash.receiptAttached",
    entityType: "PettyCashEntry",
    entityId: entry.id,
    summary: `Attached a bill/receipt to a ₹${toMoney(entry.amount)} petty cash entry for ${entry.branch.name}`,
  });

  return { ...updated, amount: toMoney(updated.amount) };
}

/** A pure oversight flag — doesn't touch the balance or the entry itself, just records that
 * a super admin has looked at it. Super-admin-only, company-wide (any branch's entries). */
export async function reviewEntry(user: AuthUser, entryId: string) {
  const entry = await prisma.pettyCashEntry.findFirst({ where: { id: entryId, companyId: user.companyId } });
  if (!entry) throw new NotFoundError("Petty cash entry not found");

  const updated = await prisma.pettyCashEntry.update({
    where: { id: entry.id },
    data: { reviewedById: user.id, reviewedAt: new Date() },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actor: user,
    branchId: entry.branchId,
    action: "pettyCash.reviewed",
    entityType: "PettyCashEntry",
    entityId: entry.id,
    summary: `Marked a ₹${toMoney(entry.amount)} petty cash entry as reviewed`,
  });

  return { ...updated, amount: toMoney(updated.amount) };
}

export async function unreviewEntry(user: AuthUser, entryId: string) {
  const entry = await prisma.pettyCashEntry.findFirst({ where: { id: entryId, companyId: user.companyId } });
  if (!entry) throw new NotFoundError("Petty cash entry not found");

  const updated = await prisma.pettyCashEntry.update({
    where: { id: entry.id },
    data: { reviewedById: null, reviewedAt: null },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    actor: user,
    branchId: entry.branchId,
    action: "pettyCash.unreviewed",
    entityType: "PettyCashEntry",
    entityId: entry.id,
    summary: `Unmarked a ₹${toMoney(entry.amount)} petty cash entry as reviewed`,
  });

  return { ...updated, amount: toMoney(updated.amount) };
}

/** Super-admin-only — same reasoning as deleting a payment: this rewrites the cash-box
 * history rather than just reversing it, reserved for genuine data-entry corrections. */
export async function deleteEntry(user: AuthUser, entryId: string) {
  const entry = await prisma.pettyCashEntry.findFirst({
    where: { id: entryId, companyId: user.companyId },
    include: { branch: { select: { name: true } } },
  });
  if (!entry) throw new NotFoundError("Petty cash entry not found");

  await prisma.pettyCashEntry.delete({ where: { id: entry.id } });

  await logAudit({
    actor: user,
    branchId: entry.branchId,
    action: "pettyCash.deleted",
    entityType: "PettyCashEntry",
    entityId: entry.id,
    summary: `Deleted a ₹${toMoney(entry.amount)} petty cash ${entry.type === "TOP_UP" ? "top-up" : "expense"} entry for ${entry.branch.name}`,
  });
}
