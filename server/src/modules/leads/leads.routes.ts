import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  addLeadActivityHandler,
  convertLeadHandler,
  createLeadHandler,
  getLeadFunnelHandler,
  getLeadHandler,
  listLeadsHandler,
  updateLeadHandler,
} from "@/modules/leads/leads.controller.js";

export const leadsRouter = Router();

leadsRouter.use(authenticate);

// Leads are pre-enrollment — same ownership as Students: a branch's own job, not accountants'.
const leadRoles = ["SUPER_ADMIN", "BRANCH_ADMIN"] as const;

leadsRouter.get("/", requireRole(...leadRoles), listLeadsHandler);
leadsRouter.get("/funnel", requireRole(...leadRoles), getLeadFunnelHandler);
leadsRouter.get("/:id", requireRole(...leadRoles), getLeadHandler);
leadsRouter.post("/", requireRole(...leadRoles), createLeadHandler);
leadsRouter.patch("/:id", requireRole(...leadRoles), updateLeadHandler);
leadsRouter.post("/:id/activities", requireRole(...leadRoles), addLeadActivityHandler);
leadsRouter.post("/:id/convert", requireRole(...leadRoles), convertLeadHandler);
