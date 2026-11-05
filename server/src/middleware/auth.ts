import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/utils/jwt.js";
import { UnauthorizedError } from "@/utils/AppError.js";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing access token");
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
