import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  companyId: string;
  branchId: string | null;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Raw request body bytes, captured for webhook signature verification (see app.ts). */
      rawBody?: Buffer;
    }
  }
}

export {};
