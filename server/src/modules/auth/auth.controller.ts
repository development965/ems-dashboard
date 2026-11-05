import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { loginSchema, refreshSchema } from "@/modules/auth/auth.schema.js";
import * as authService from "@/modules/auth/auth.service.js";

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  res.json(result);
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken);
  res.json(tokens);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: req.user });
});
