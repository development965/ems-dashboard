import { api } from "@/lib/api";
import type { Student } from "@/types/student";
import type { ConvertLeadInput, CreateLeadInput, Lead, LeadActivity, LeadFunnel, UpdateLeadInput } from "@/types/lead";

/** `<input type="date">` gives "YYYY-MM-DD" in local time — construct explicitly rather than
 * `new Date(str)` (which parses as UTC midnight) to avoid an off-by-one-day near midnight. */
function toStartOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}
function toEndOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** `from`/`to` are "YYYY-MM-DD" and filter on when the lead was created. */
function dateRangeParams(from?: string, to?: string) {
  return {
    from: from ? toStartOfDayIso(from) : undefined,
    to: to ? toEndOfDayIso(to) : undefined,
  };
}

export async function fetchLeads(filters: {
  branchId?: string;
  status?: string;
  source?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<Lead[]> {
  const { from, to, ...rest } = filters;
  const { data } = await api.get<{ leads: Lead[] }>("/leads", { params: { ...rest, ...dateRangeParams(from, to) } });
  return data.leads;
}

export async function fetchLead(id: string): Promise<Lead> {
  const { data } = await api.get<{ lead: Lead }>(`/leads/${id}`);
  return data.lead;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data } = await api.post<{ lead: Lead }>("/leads", input);
  return data.lead;
}

export async function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  const { data } = await api.patch<{ lead: Lead }>(`/leads/${id}`, input);
  return data.lead;
}

export async function addLeadActivity(id: string, note: string): Promise<LeadActivity> {
  const { data } = await api.post<{ activity: LeadActivity }>(`/leads/${id}/activities`, { note });
  return data.activity;
}

export async function convertLead(id: string, input: ConvertLeadInput): Promise<Student> {
  const { data } = await api.post<{ student: Student }>(`/leads/${id}/convert`, input);
  return data.student;
}

export async function fetchLeadFunnel(filters: { branchId?: string; from?: string; to?: string } = {}): Promise<LeadFunnel> {
  const { data } = await api.get<LeadFunnel>("/leads/funnel", {
    params: { branchId: filters.branchId || undefined, ...dateRangeParams(filters.from, filters.to) },
  });
  return data;
}
