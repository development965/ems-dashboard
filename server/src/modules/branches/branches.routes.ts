import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  createBranchHandler,
  deleteBranchHandler,
  getBranchHandler,
  listBranchesHandler,
  updateBranchHandler,
} from "@/modules/branches/branches.controller.js";

export const branchesRouter = Router();

branchesRouter.use(authenticate);

// All roles can view branches within their own scope (super admin: all, others: their own branch).
branchesRouter.get("/", listBranchesHandler);
branchesRouter.get("/:id", getBranchHandler);

// Only super admins manage branches.
branchesRouter.post("/", requireRole("SUPER_ADMIN"), createBranchHandler);
branchesRouter.patch("/:id", requireRole("SUPER_ADMIN"), updateBranchHandler);
branchesRouter.delete("/:id", requireRole("SUPER_ADMIN"), deleteBranchHandler);
