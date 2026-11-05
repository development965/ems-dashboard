import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  createRevenueShareSchema,
  revenueShareFiltersSchema,
  reviewRevenueShareSchema,
  settleRevenueShareSchema,
} from "@/modules/revenueShares/revenueShares.schema.js";
import * as revenueSharesService from "@/modules/revenueShares/revenueShares.service.js";

export const listBranchDirectoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const branches = await revenueSharesService.listBranchDirectory(req.user!);
  res.json({ branches });
});

export const listRevenueSharesHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = revenueShareFiltersSchema.parse(req.query);
  const shares = await revenueSharesService.listRevenueShares(req.user!, filters);
  res.json({ shares });
});

export const createRevenueShareHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createRevenueShareSchema.parse(req.body);
  const share = await revenueSharesService.createRevenueShare(req.user!, input);
  res.status(201).json({ share });
});

export const settleRevenueShareHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = settleRevenueShareSchema.parse(req.body);
  const share = await revenueSharesService.settleRevenueShare(req.user!, req.params.id, input);
  res.json({ share });
});

export const reviewRevenueShareHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = reviewRevenueShareSchema.parse(req.body);
  const share = await revenueSharesService.reviewRevenueShare(req.user!, req.params.id, input);
  res.json({ share });
});

export const deleteRevenueShareHandler = asyncHandler(async (req: Request, res: Response) => {
  await revenueSharesService.deleteRevenueShare(req.user!, req.params.id);
  res.status(204).end();
});
