import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { listTargetsHandler, setTargetHandler } from "@/modules/targets/targets.controller.js";

export const targetsRouter = Router();

targetsRouter.use(authenticate);

// Setting a target is super-admin-only, per explicit product decision — but a branch admin
// can read their own branch's target/actual so it can be surfaced on their dashboard.
targetsRouter.get("/", requireRole("SUPER_ADMIN", "BRANCH_ADMIN"), listTargetsHandler);
targetsRouter.post("/", requireRole("SUPER_ADMIN"), setTargetHandler);
