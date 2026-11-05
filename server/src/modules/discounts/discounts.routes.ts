import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { createDiscountHandler, listDiscountsHandler } from "@/modules/discounts/discounts.controller.js";

export const discountsRouter = Router();

discountsRouter.use(authenticate);

// Discounting is a financial decision — super admins and accountants only, never branch admins.
discountsRouter.get("/", requireRole("SUPER_ADMIN", "ACCOUNTANT"), listDiscountsHandler);
discountsRouter.post("/", requireRole("SUPER_ADMIN", "ACCOUNTANT"), createDiscountHandler);
