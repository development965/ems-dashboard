import { prisma } from "@/config/prisma.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter, resolveTargetBranchId } from "@/middleware/rbac.js";
import * as studentsService from "@/modules/students/students.service.js";
import { inScopeFilter } from "@/config/scope.js";
import type {
  AddLeadActivityInput,
  ConvertLeadInput,
  CreateLeadInput,
  LeadFilters,
  LeadFunnelFilters,
  UpdateLeadInput,
} from "@/modules/leads/leads.schema.js";

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

const includeForSummary = {
  branch: { select: { id: true, name: true } },
  interestedCourse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  activities: { orderBy: { createdAt: "desc" as const }, include: { createdBy: { select: { id: true, name: true } } } },
  convertedStudent: { select: { id: true, name: true } },
};

export async function listLeads(user: AuthUser, filters: LeadFilters) {
  const createdAtRange = dateRange(filters.from, filters.to);
  return prisma.lead.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...inScopeFilter,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search } }, { phone: { contains: filters.search } }] }
        : {}),
    },
    include: {
      branch: { select: { id: true, name: true } },
      interestedCourse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLead(user: AuthUser, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: user.companyId, ...branchScopeFilter(user), ...inScopeFilter },
    include: includeForSummary,
  });
  if (!lead) throw new NotFoundError("Lead not found");
  return lead;
}

export async function createLead(user: AuthUser, input: CreateLeadInput) {
  const branchId = resolveTargetBranchId(user, input.branchId);

  if (input.interestedCourseId) {
    const course = await prisma.course.findFirst({ where: { id: input.interestedCourseId, companyId: user.companyId } });
    if (!course) throw new NotFoundError("Course not found");
  }

  const lead = await prisma.lead.create({
    data: {
      companyId: user.companyId,
      branchId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: input.source,
      sourceDetail: input.source === "OTHER" ? input.sourceDetail : undefined,
      interestedCourseId: input.interestedCourseId,
      followUpAt: input.followUpAt,
      notes: input.notes,
      createdById: user.id,
    },
    include: includeForSummary,
  });

  await logAudit({
    actor: user,
    branchId: lead.branchId,
    action: "lead.create",
    entityType: "Lead",
    entityId: lead.id,
    summary: `New lead: ${lead.name} (${lead.source}) at ${lead.branch.name}`,
  });

  return lead;
}

export async function updateLead(user: AuthUser, leadId: string, input: UpdateLeadInput) {
  const existing = await getLead(user, leadId);
  if (existing.status === "CONVERTED") {
    throw new ConflictError("This lead has already converted to a student — no further edits needed.");
  }

  if (input.interestedCourseId) {
    const course = await prisma.course.findFirst({ where: { id: input.interestedCourseId, companyId: user.companyId } });
    if (!course) throw new NotFoundError("Course not found");
  }
  if (input.status === "LOST" && !input.lostReason && !existing.lostReason) {
    throw new ConflictError("Give a reason when marking a lead as lost.");
  }

  const effectiveSource = input.source ?? existing.source;
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: input.source,
      // Clear the free-text detail once the source is no longer "Other" — it'd be stale otherwise.
      sourceDetail: effectiveSource === "OTHER" ? (input.sourceDetail ?? existing.sourceDetail) : null,
      interestedCourseId: input.interestedCourseId,
      status: input.status,
      followUpAt: input.followUpAt,
      lostReason: input.status === "LOST" ? (input.lostReason ?? existing.lostReason) : input.lostReason,
      notes: input.notes,
    },
    include: includeForSummary,
  });

  if (input.status !== undefined && input.status !== existing.status) {
    await logAudit({
      actor: user,
      branchId: lead.branchId,
      action: "lead.status_changed",
      entityType: "Lead",
      entityId: lead.id,
      summary: `Changed ${lead.name}'s lead status from ${existing.status} to ${input.status}`,
    });
  }

  return lead;
}

export async function addLeadActivity(user: AuthUser, leadId: string, input: AddLeadActivityInput) {
  const lead = await getLead(user, leadId); // ensures branch scope + existence

  const activity = await prisma.leadActivity.create({
    data: { leadId: lead.id, note: input.note, createdById: user.id },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  // A logged touchpoint implies contact was made — nudge a fresh NEW lead forward automatically.
  if (lead.status === "NEW") {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
  }

  return activity;
}

/** Creates a real Student from this lead and marks the lead CONVERTED, linked to it. */
export async function convertLead(user: AuthUser, leadId: string, input: ConvertLeadInput) {
  const lead = await getLead(user, leadId);
  if (lead.status === "CONVERTED") throw new ConflictError("This lead has already converted.");

  const student = await studentsService.createStudent(user, {
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? undefined,
    location: input.location,
    courseId: input.courseId,
    batchId: input.batchId,
    mode: input.mode,
    totalFee: input.totalFee,
    notes: `Converted from lead (source: ${lead.source})`,
    branchId: lead.branchId,
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "CONVERTED", convertedStudentId: student.id },
  });

  await logAudit({
    actor: user,
    branchId: lead.branchId,
    action: "lead.converted",
    entityType: "Lead",
    entityId: lead.id,
    summary: `Converted lead ${lead.name} into a student enrollment`,
  });

  return student;
}

export async function getLeadFunnel(user: AuthUser, filters: LeadFunnelFilters = {}) {
  const createdAtRange = dateRange(filters.from, filters.to);
  const leads = await prisma.lead.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...inScopeFilter,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    },
    select: { status: true, source: true, branchId: true, branch: { select: { name: true } } },
  });

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byBranchMap = new Map<string, { branchId: string; branchName: string; total: number; converted: number }>();
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
    const entry = byBranchMap.get(l.branchId) ?? { branchId: l.branchId, branchName: l.branch.name, total: 0, converted: 0 };
    entry.total += 1;
    if (l.status === "CONVERTED") entry.converted += 1;
    byBranchMap.set(l.branchId, entry);
  }

  const total = leads.length;
  const converted = byStatus.CONVERTED ?? 0;
  const lost = byStatus.LOST ?? 0;

  return {
    total,
    converted,
    lost,
    open: total - converted - lost,
    conversionRatePct: total > 0 ? Math.round((converted / total) * 1000) / 10 : null,
    byStatus,
    bySource,
    byBranch: Array.from(byBranchMap.values()).sort((a, b) => b.total - a.total),
  };
}
