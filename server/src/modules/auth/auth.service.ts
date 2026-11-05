import { prisma } from "@/config/prisma.js";
import { env } from "@/config/env.js";
import { comparePassword } from "@/utils/password.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/utils/jwt.js";
import { UnauthorizedError } from "@/utils/AppError.js";
import type { LoginInput } from "@/modules/auth/auth.schema.js";
import ms from "ms";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: { id: string; companyId: string; branchId: string | null; role: import("@prisma/client").Role }): Promise<TokenPair> {
  const accessToken = signAccessToken({
    id: user.id,
    companyId: user.companyId,
    branchId: user.branchId,
    role: user.role,
  });
  const refreshToken = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_TTL)),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.isActive) throw new UnauthorizedError("Invalid email or password");

  const passwordMatches = await comparePassword(input.password, user.passwordHash);
  if (!passwordMatches) throw new UnauthorizedError("Invalid email or password");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const tokens = await issueTokens(user);

  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId,
    },
  };
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new UnauthorizedError("Account is no longer active");

  // Rotate: revoke the used refresh token and issue a new pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  return issueTokens(user);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
