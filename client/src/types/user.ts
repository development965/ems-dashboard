import type { Role } from "@/types/auth";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  branchId?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  branchId?: string | null;
  isActive?: boolean;
}
