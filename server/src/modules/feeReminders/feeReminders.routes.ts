import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  createFeeReminderHandler,
  listReminderHistoryHandler,
  listStudentsNeedingRemindersHandler,
} from "@/modules/feeReminders/feeReminders.controller.js";

export const feeRemindersRouter = Router();

feeRemindersRouter.use(authenticate);

const feeCollectorRoles = ["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"] as const;

feeRemindersRouter.get("/", requireRole(...feeCollectorRoles), listStudentsNeedingRemindersHandler);
feeRemindersRouter.post("/", requireRole(...feeCollectorRoles), createFeeReminderHandler);
feeRemindersRouter.get("/student/:studentId", requireRole(...feeCollectorRoles), listReminderHistoryHandler);
