import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { listAuditActionsHandler, listAuditLogsHandler } from "@/modules/audit/audit.controller.js";

export const auditRouter = Router();

auditRouter.use(authenticate);

// Accountability trail across many branch admins — a super-admin-only capability.
auditRouter.get("/", requireRole("SUPER_ADMIN"), listAuditLogsHandler);
auditRouter.get("/actions", requireRole("SUPER_ADMIN"), listAuditActionsHandler);
