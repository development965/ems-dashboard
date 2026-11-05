import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  addFeeStructureHandler,
  createCourseHandler,
  deleteCourseHandler,
  deleteFeeStructureHandler,
  getCourseHandler,
  listCoursesHandler,
  updateCourseHandler,
  updateFeeStructureHandler,
} from "@/modules/courses/courses.controller.js";

export const coursesRouter = Router();

coursesRouter.use(authenticate);

// The course catalog is shared company-wide — every role can view it (e.g. when enrolling a student).
coursesRouter.get("/", listCoursesHandler);
coursesRouter.get("/:id", getCourseHandler);

// Master data — owned by super admins and accountants, not branch admins.
coursesRouter.post("/", requireRole("SUPER_ADMIN", "ACCOUNTANT"), createCourseHandler);
coursesRouter.patch("/:id", requireRole("SUPER_ADMIN", "ACCOUNTANT"), updateCourseHandler);
coursesRouter.delete("/:id", requireRole("SUPER_ADMIN", "ACCOUNTANT"), deleteCourseHandler);
coursesRouter.post("/:id/fee-structures", requireRole("SUPER_ADMIN", "ACCOUNTANT"), addFeeStructureHandler);
coursesRouter.patch("/:id/fee-structures/:feeId", requireRole("SUPER_ADMIN", "ACCOUNTANT"), updateFeeStructureHandler);
coursesRouter.delete("/:id/fee-structures/:feeId", requireRole("SUPER_ADMIN", "ACCOUNTANT"), deleteFeeStructureHandler);
