import type { CourseMode } from "@/types/course";

export interface Batch {
  id: string;
  companyId: string;
  branchId: string;
  courseId: string;
  name: string;
  mode: CourseMode;
  schedule: string;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  isActive: boolean;
  course: { id: string; name: string; code: string };
  branch: { id: string; name: string };
}

export interface CreateBatchInput {
  courseId: string;
  name: string;
  mode: CourseMode;
  schedule: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  branchId?: string;
}
