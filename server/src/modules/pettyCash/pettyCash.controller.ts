import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { AppError } from "@/utils/AppError.js";
import { toPublicUploadUrl } from "@/middleware/upload.js";
import { createPettyCashEntrySchema, pettyCashFiltersSchema } from "@/modules/pettyCash/pettyCash.schema.js";
import * as pettyCashService from "@/modules/pettyCash/pettyCash.service.js";

export const listEntriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = pettyCashFiltersSchema.parse(req.query);
  const entries = await pettyCashService.listEntries(req.user!, filters);
  res.json({ entries });
});

export const getBalancesHandler = asyncHandler(async (req: Request, res: Response) => {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const balances = await pettyCashService.getBalances(req.user!, branchId);
  res.json(balances);
});

export const createEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createPettyCashEntrySchema.parse(req.body);
  const file = req.file as Express.Multer.File | undefined;
  if (input.type === "EXPENSE" && !file) throw new AppError('A bill/receipt is required for an expense ("receipt")', 422);

  const entry = await pettyCashService.createEntry(req.user!, input, file ? toPublicUploadUrl(file.path) : undefined);
  res.status(201).json({ entry });
});

export const attachReceiptHandler = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new AppError('Attach a receipt file ("receipt")', 422);

  const entry = await pettyCashService.attachReceipt(req.user!, req.params.id, toPublicUploadUrl(file.path));
  res.json({ entry });
});

export const reviewEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  const entry = await pettyCashService.reviewEntry(req.user!, req.params.id);
  res.json({ entry });
});

export const unreviewEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  const entry = await pettyCashService.unreviewEntry(req.user!, req.params.id);
  res.json({ entry });
});

export const deleteEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  await pettyCashService.deleteEntry(req.user!, req.params.id);
  res.status(204).end();
});
