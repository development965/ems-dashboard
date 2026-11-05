import { api } from "@/lib/api";
import type { AuditActionOptions, AuditLogEntry } from "@/types/audit";

export async function fetchAuditLogs(filters: {
  branchId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}): Promise<AuditLogEntry[]> {
  const { data } = await api.get<{ logs: AuditLogEntry[] }>("/audit", { params: filters });
  return data.logs;
}

export async function fetchAuditActionOptions(): Promise<AuditActionOptions> {
  const { data } = await api.get<AuditActionOptions>("/audit/actions");
  return data;
}
