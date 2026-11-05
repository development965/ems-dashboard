import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { createFeeReminderSchema } from "@/modules/feeReminders/feeReminders.schema.js";
import * as feeRemindersService from "@/modules/feeReminders/feeReminders.service.js";

export const listStudentsNeedingRemindersHandler = asyncHandler(async (req: Request, res: Response) => {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const students = await feeRemindersService.listStudentsNeedingReminders(req.user!, branchId);
  res.json({ students });
});

export const createFeeReminderHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createFeeReminderSchema.parse(req.body);
  const reminder = await feeRemindersService.createFeeReminder(req.user!, input);
  res.status(201).json({ reminder });
});

export const listReminderHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const reminders = await feeRemindersService.listReminderHistory(req.user!, req.params.studentId);
  res.json({ reminders });
});
