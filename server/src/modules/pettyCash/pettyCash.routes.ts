import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { uploadNewPettyCashReceipt, uploadPettyCashReceipt } from "@/middleware/upload.js";
import {
  attachReceiptHandler,
  createEntryHandler,
  deleteEntryHandler,
  getBalancesHandler,
  listEntriesHandler,
  reviewEntryHandler,
  unreviewEntryHandler,
} from "@/modules/pettyCash/pettyCash.controller.js";

export const pettyCashRouter = Router();

pettyCashRouter.use(authenticate);

// Branch admins manage their own branch's cash box; super admins/accountants see and manage
// every branch — same split as enrollment vs. company-wide finance elsewhere in the app.
const pettyCashRoles = ["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"] as const;

pettyCashRouter.get("/", requireRole(...pettyCashRoles), listEntriesHandler);
pettyCashRouter.get("/balances", requireRole(...pettyCashRoles), getBalancesHandler);

// Recording an entry directly (as opposed to via an approved requisition) is split by type:
// only a branch raises its own expenses, only the super admin injects a top-up outright.
// Which type a given role may submit is enforced in the service, not here.
pettyCashRouter.post("/", requireRole("SUPER_ADMIN", "BRANCH_ADMIN"), uploadNewPettyCashReceipt, createEntryHandler);
pettyCashRouter.post("/:id/receipt", requireRole(...pettyCashRoles), uploadPettyCashReceipt, attachReceiptHandler);

// Oversight pass on branch-recorded expenses — a lightweight flag, not a gate: the entry
// already counts toward the balance the moment it's recorded, this just tracks whether a
// super admin has looked at it.
pettyCashRouter.post("/:id/review", requireRole("SUPER_ADMIN"), reviewEntryHandler);
pettyCashRouter.delete("/:id/review", requireRole("SUPER_ADMIN"), unreviewEntryHandler);

// Deleting an entry rewrites the cash box's history — reserved for super admins only.
pettyCashRouter.delete("/:id", requireRole("SUPER_ADMIN"), deleteEntryHandler);
