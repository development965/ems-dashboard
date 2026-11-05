import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { downloadBackupHandler } from "@/modules/backup/backup.controller.js";

export const backupRouter = Router();

backupRouter.use(authenticate);

// A full database dump — every student, payment, and password hash in the system. Super
// admin only, no exceptions (not even accountants).
backupRouter.get("/download", requireRole("SUPER_ADMIN"), downloadBackupHandler);
