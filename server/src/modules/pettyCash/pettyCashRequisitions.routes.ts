import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  createRequisitionHandler,
  decideRequisitionHandler,
  fulfillRequisitionHandler,
  listRequisitionsHandler,
} from "@/modules/pettyCash/pettyCashRequisitions.controller.js";

export const pettyCashRequisitionsRouter = Router();

pettyCashRequisitionsRouter.use(authenticate);

// Super admins/accountants see every branch's requisitions (needed to approve/fulfill);
// branch admins see and raise only their own.
pettyCashRequisitionsRouter.get("/", requireRole("SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"), listRequisitionsHandler);

// Only a branch itself asks HQ for funds — this is deliberately narrower than the
// petty-cash entry roles above.
pettyCashRequisitionsRouter.post("/", requireRole("BRANCH_ADMIN"), createRequisitionHandler);

// The approval gate the branch's request has to pass before anyone can act on it.
pettyCashRequisitionsRouter.post("/:id/decision", requireRole("SUPER_ADMIN"), decideRequisitionHandler);

// Once approved, accounts (or a super admin standing in) actually moves the money.
pettyCashRequisitionsRouter.post("/:id/fulfill", requireRole("SUPER_ADMIN", "ACCOUNTANT"), fulfillRequisitionHandler);
