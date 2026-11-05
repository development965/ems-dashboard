import type { CourseMode } from "@/types/course";

export type LeadStatus = "NEW" | "CONTACTED" | "INTERESTED" | "TRIAL_SCHEDULED" | "CONVERTED" | "LOST";
export type LeadSource = "WALK_IN" | "PHONE" | "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "OTHER";

export interface LeadActivity {
  id: string;
  leadId: string;
  note: string;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface Lead {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  sourceDetail: string | null;
  interestedCourseId: string | null;
  status: LeadStatus;
  followUpAt: string | null;
  lostReason: string | null;
  notes: string | null;
  convertedStudentId: string | null;
  createdAt: string;
  branch: { id: string; name: string };
  interestedCourse: { id: string; name: string } | null;
  createdBy?: { id: string; name: string };
  activities?: LeadActivity[];
  convertedStudent?: { id: string; name: string } | null;
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  sourceDetail?: string;
  interestedCourseId?: string;
  followUpAt?: string;
  notes?: string;
  branchId?: string;
}

export interface UpdateLeadInput {
  name?: string;
  phone?: string;
  email?: string;
  source?: LeadSource;
  sourceDetail?: string;
  interestedCourseId?: string | null;
  status?: LeadStatus;
  followUpAt?: string | null;
  lostReason?: string;
  notes?: string;
}

export interface ConvertLeadInput {
  courseId: string;
  batchId?: string;
  mode: CourseMode;
  totalFee: number;
  location: string;
}

export interface LeadFunnel {
  total: number;
  converted: number;
  lost: number;
  open: number;
  conversionRatePct: number | null;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byBranch: { branchId: string; branchName: string; total: number; converted: number }[];
}
