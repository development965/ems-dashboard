import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { logAudit } from "@/utils/audit.js";
import { streamDatabaseBackup } from "@/modules/backup/backup.service.js";

export const downloadBackupHandler = asyncHandler(async (req: Request, res: Response) => {
  // Logged before streaming starts — downloading a full data export is one of the most
  // sensitive actions in the app, and worth a record even if the dump itself later fails.
  await logAudit({
    actor: req.user!,
    action: "backup.downloaded",
    entityType: "Database",
    summary: `Downloaded a full database backup`,
  });

  await streamDatabaseBackup(res);
});
