import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { prisma } from "@/config/prisma.js";
import { NotFoundError } from "@/utils/AppError.js";
import { updateCompanySchema } from "@/modules/companies/companies.schema.js";

export const getOwnCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
  const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } });
  if (!company) throw new NotFoundError("Company not found");
  res.json({ company });
});

export const updateOwnCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCompanySchema.parse(req.body);
  const company = await prisma.company.update({ where: { id: req.user!.companyId }, data: input });
  res.json({ company });
});
