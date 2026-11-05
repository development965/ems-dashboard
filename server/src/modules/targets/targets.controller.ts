import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { setTargetSchema, targetFiltersSchema } from "@/modules/targets/targets.schema.js";
import * as targetsService from "@/modules/targets/targets.service.js";

export const listTargetsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { year, month } = targetFiltersSchema.parse(req.query);
  const targets = await targetsService.listTargets(req.user!, year, month);
  res.json(targets);
});

export const setTargetHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = setTargetSchema.parse(req.body);
  const target = await targetsService.setTarget(req.user!, input);
  res.status(201).json({ target });
});
