import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import { uploadStudentDocuments } from "@/middleware/upload.js";
import {
  createStudentHandler,
  getStudentHandler,
  listStudentsHandler,
  updateStudentHandler,
  uploadStudentDocumentsHandler,
} from "@/modules/students/students.controller.js";

export const studentsRouter = Router();

studentsRouter.use(authenticate);

studentsRouter.get("/", listStudentsHandler);
studentsRouter.get("/:id", getStudentHandler);

// Front-desk enrollment capture — a branch's own job. Accountants are company-wide on the
// finance side (fees/payments/discounts/reports) but don't manage enrollment records.
studentsRouter.post("/", requireRole("SUPER_ADMIN", "BRANCH_ADMIN"), createStudentHandler);
studentsRouter.patch("/:id", requireRole("SUPER_ADMIN", "BRANCH_ADMIN"), updateStudentHandler);
studentsRouter.post(
  "/:id/documents",
  requireRole("SUPER_ADMIN", "BRANCH_ADMIN"),
  uploadStudentDocuments,
  uploadStudentDocumentsHandler,
);
