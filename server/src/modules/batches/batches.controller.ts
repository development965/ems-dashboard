import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { createBatchSchema, updateBatchSchema } from "@/modules/batches/batches.schema.js";
import * as batchesService from "@/modules/batches/batches.service.js";

export const listBatchesHandler = asyncHandler(async (req: Request, res: Response) => {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const batches = await batchesService.listBatches(req.user!, courseId);
  res.json({ batches });
});

export const getBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchesService.getBatch(req.user!, req.params.id);
  res.json({ batch });
});

export const createBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createBatchSchema.parse(req.body);
  const batch = await batchesService.createBatch(req.user!, input);
  res.status(201).json({ batch });
});

export const updateBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateBatchSchema.parse(req.body);
  const batch = await batchesService.updateBatch(req.user!, req.params.id, input);
  res.json({ batch });
});

export const deleteBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  await batchesService.deleteBatch(req.user!, req.params.id);
  res.status(204).send();
});
