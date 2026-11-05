import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "@/config/env.js";
import type { AuthUser } from "@/types/express.js";

export type AccessTokenPayload = AuthUser;

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}

/** Refresh tokens are stored hashed so a leaked DB dump doesn't yield usable tokens. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
