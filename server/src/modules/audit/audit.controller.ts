import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { auditFiltersSchema } from "@/modules/audit/audit.schema.js";
import * as auditService from "@/modules/audit/audit.service.js";

export const listAuditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = auditFiltersSchema.parse(req.query);
  const logs = await auditService.listAuditLogs(req.user!, filters);
  res.json({ logs });
});

export const listAuditActionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const options = await auditService.listAuditActions(req.user!);
  res.json(options);
});
