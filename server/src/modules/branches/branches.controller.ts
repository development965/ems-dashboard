import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { createBranchSchema, updateBranchSchema } from "@/modules/branches/branches.schema.js";
import * as branchesService from "@/modules/branches/branches.service.js";

export const listBranchesHandler = asyncHandler(async (req: Request, res: Response) => {
  const branches = await branchesService.listBranches(req.user!);
  res.json({ branches });
});

export const getBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  const branch = await branchesService.getBranch(req.user!, req.params.id);
  res.json({ branch });
});

export const createBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createBranchSchema.parse(req.body);
  const branch = await branchesService.createBranch(req.user!, input);
  res.status(201).json({ branch });
});

export const updateBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateBranchSchema.parse(req.body);
  const branch = await branchesService.updateBranch(req.user!, req.params.id, input);
  res.json({ branch });
});

export const deleteBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  await branchesService.deleteBranch(req.user!, req.params.id);
  res.status(204).send();
});
