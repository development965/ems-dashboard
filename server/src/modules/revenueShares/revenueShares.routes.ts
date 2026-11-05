import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  createRevenueShareHandler,
  deleteRevenueShareHandler,
  listBranchDirectoryHandler,
  listRevenueSharesHandler,
  reviewRevenueShareHandler,
  settleRevenueShareHandler,
} from "@/modules/revenueShares/revenueShares.controller.js";

export const revenueSharesRouter = Router();

revenueSharesRouter.use(authenticate);

const revenueShareRoles = ["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"] as const;

// Branch id+name for every branch — needed to pick a service branch even though a branch
// admin can't otherwise list branches outside their own.
revenueSharesRouter.get("/branches", requireRole(...revenueShareRoles), listBranchDirectoryHandler);

// Everyone in scope can view — a branch admin sees only shares they're on either side of;
// super admins/accountants see everything (branch-scoping enforced in the service).
revenueSharesRouter.get("/", requireRole(...revenueShareRoles), listRevenueSharesHandler);

// Only the branch that actually collected the payment (or a super admin) can flag it shared.
revenueSharesRouter.post("/", requireRole("SUPER_ADMIN", "BRANCH_ADMIN"), createRevenueShareHandler);

// Settling means real money has moved between branches — same gate as a petty cash top-up.
revenueSharesRouter.post("/:id/settle", requireRole("SUPER_ADMIN"), settleRevenueShareHandler);

// The Transfers tab's sign-off — accept or dispute an already-settled transfer. Either role
// suffices, no dual sign-off required.
revenueSharesRouter.post("/:id/review", requireRole("SUPER_ADMIN", "ACCOUNTANT"), reviewRevenueShareHandler);

// Corrections only — reserved for super admins.
revenueSharesRouter.delete("/:id", requireRole("SUPER_ADMIN"), deleteRevenueShareHandler);
