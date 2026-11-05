import { Router } from "express";
import { loginHandler, logoutHandler, meHandler, refreshHandler } from "@/modules/auth/auth.controller.js";
import { authenticate } from "@/middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", loginHandler);
authRouter.post("/refresh", refreshHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", authenticate, meHandler);
