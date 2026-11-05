export type CourseMode = "ONLINE" | "OFFLINE" | "HYBRID";

export interface FeeStructure {
  id: string;
  courseId: string;
  label: string;
  mode: CourseMode;
  amount: number;
  currency: string;
  isActive: boolean;
}

export interface Course {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description: string | null;
  durationText: string | null;
  isActive: boolean;
  feeStructures: FeeStructure[];
  createdAt: string;
}

export interface CreateCourseInput {
  name: string;
  code: string;
  description?: string;
  durationText?: string;
}

export interface CreateFeeStructureInput {
  label: string;
  mode: CourseMode;
  amount: number;
  currency?: string;
}
