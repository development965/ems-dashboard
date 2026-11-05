export interface AuditLogEntry {
  id: string;
  companyId: string;
  branchId: string | null;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
}

export interface AuditActionOptions {
  actions: string[];
  entityTypes: string[];
}
