import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  createBatchHandler,
  deleteBatchHandler,
  getBatchHandler,
  listBatchesHandler,
  updateBatchHandler,
} from "@/modules/batches/batches.controller.js";

export const batchesRouter = Router();

batchesRouter.use(authenticate);

batchesRouter.get("/", listBatchesHandler);
batchesRouter.get("/:id", getBatchHandler);

// Master data — owned by super admins and accountants, not branch admins.
batchesRouter.post("/", requireRole("SUPER_ADMIN", "ACCOUNTANT"), createBatchHandler);
batchesRouter.patch("/:id", requireRole("SUPER_ADMIN", "ACCOUNTANT"), updateBatchHandler);
batchesRouter.delete("/:id", requireRole("SUPER_ADMIN", "ACCOUNTANT"), deleteBatchHandler);
