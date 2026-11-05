import type { CourseMode } from "@/types/course";

export type StudentStatus = "ENROLLED" | "COMPLETED" | "DROPPED";
export type CertificationStatus = "NOT_ISSUED" | "ISSUED";
export type PlacementStatus = "NOT_PLACED" | "IN_PROGRESS" | "PLACED";

export interface Student {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  phone: string;
  email: string | null;
  location: string;
  courseId: string;
  batchId: string | null;
  mode: CourseMode;
  totalFee: number;
  totalDiscount: number;
  netFee: number;
  amountPaid: number;
  balanceDue: number;
  status: StudentStatus;
  notes: string | null;
  photoUrl: string | null;
  idProofUrl: string | null;
  createdAt: string;
  course: { id: string; name: string; code: string };
  batch: { id: string; name: string } | null;
  branch: { id: string; name: string };
  certificationStatus: CertificationStatus;
  certificateNo: string | null;
  certificateIssuedAt: string | null;
  placementStatus: PlacementStatus;
  placementCompany: string | null;
  placementRole: string | null;
  placementPackageLPA: number | null;
  placedAt: string | null;
}

export interface CreateStudentInput {
  name: string;
  phone: string;
  email?: string;
  location: string;
  courseId: string;
  batchId?: string;
  mode: CourseMode;
  totalFee: number;
  notes?: string;
  branchId?: string;
}

export interface UpdateStudentInput {
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  batchId?: string | null;
  mode?: CourseMode;
  totalFee?: number;
  status?: StudentStatus;
  notes?: string;
  certificationStatus?: CertificationStatus;
  certificateNo?: string;
  certificateIssuedAt?: string;
  placementStatus?: PlacementStatus;
  placementCompany?: string;
  placementRole?: string;
  placementPackageLPA?: number;
  placedAt?: string;
}
