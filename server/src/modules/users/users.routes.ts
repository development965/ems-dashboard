import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  changeOwnPasswordHandler,
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  resetUserPasswordHandler,
  updateUserHandler,
} from "@/modules/users/users.controller.js";

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.post("/me/change-password", changeOwnPasswordHandler);

// User management is a super-admin capability; branch admins/accountants don't manage accounts.
usersRouter.get("/", requireRole("SUPER_ADMIN"), listUsersHandler);
usersRouter.get("/:id", requireRole("SUPER_ADMIN"), getUserHandler);
usersRouter.post("/", requireRole("SUPER_ADMIN"), createUserHandler);
usersRouter.patch("/:id", requireRole("SUPER_ADMIN"), updateUserHandler);
usersRouter.post("/:id/reset-password", requireRole("SUPER_ADMIN"), resetUserPasswordHandler);
usersRouter.delete("/:id", requireRole("SUPER_ADMIN"), deleteUserHandler);
