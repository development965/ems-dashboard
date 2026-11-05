export type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "ACCOUNTANT";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  branchId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}
