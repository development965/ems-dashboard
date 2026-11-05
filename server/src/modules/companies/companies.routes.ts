import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { getOwnCompanyHandler, updateOwnCompanyHandler } from "@/modules/companies/companies.controller.js";

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.get("/me", getOwnCompanyHandler);
companiesRouter.patch("/me", requireRole("SUPER_ADMIN"), updateOwnCompanyHandler);
