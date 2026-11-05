import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { createDiscountSchema } from "@/modules/discounts/discounts.schema.js";
import * as discountsService from "@/modules/discounts/discounts.service.js";

export const listDiscountsHandler = asyncHandler(async (req: Request, res: Response) => {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const discounts = await discountsService.listDiscounts(req.user!, studentId);
  res.json({ discounts });
});

export const createDiscountHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createDiscountSchema.parse(req.body);
  const discount = await discountsService.createDiscount(req.user!, input);
  res.status(201).json({ discount });
});
