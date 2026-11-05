import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  createPettyCashRequisitionSchema,
  decideRequisitionSchema,
  requisitionFiltersSchema,
} from "@/modules/pettyCash/pettyCashRequisitions.schema.js";
import * as requisitionsService from "@/modules/pettyCash/pettyCashRequisitions.service.js";

export const listRequisitionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = requisitionFiltersSchema.parse(req.query);
  const requisitions = await requisitionsService.listRequisitions(req.user!, filters);
  res.json({ requisitions });
});

export const createRequisitionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createPettyCashRequisitionSchema.parse(req.body);
  const requisition = await requisitionsService.createRequisition(req.user!, input);
  res.status(201).json({ requisition });
});

export const decideRequisitionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = decideRequisitionSchema.parse(req.body);
  const requisition = await requisitionsService.decideRequisition(req.user!, req.params.id, input);
  res.json({ requisition });
});

export const fulfillRequisitionHandler = asyncHandler(async (req: Request, res: Response) => {
  const requisition = await requisitionsService.fulfillRequisition(req.user!, req.params.id);
  res.json({ requisition });
});
