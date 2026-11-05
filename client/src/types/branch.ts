export type Zone = "ZONE_1" | "ZONE_2" | "ZONE_3";

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  zone: Zone | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  zone?: Zone | null;
}
