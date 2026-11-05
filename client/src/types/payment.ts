export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "RAZORPAY_LINK" | "OTHER";
export type PaymentLinkStatus = "CREATED" | "PAID" | "EXPIRED" | "CANCELLED";

export interface PaymentLink {
  id: string;
  studentId: string;
  amount: number;
  currency: string;
  description: string | null;
  status: PaymentLinkStatus;
  shortUrl: string;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  student: { id: string; name: string; phone: string };
}

export interface Payment {
  id: string;
  studentId: string;
  branchId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  notes: string | null;
  student: { id: string; name: string; phone: string };
  recordedBy: { id: string; name: string };
  branch: { id: string; name: string };
}

export interface CreatePaymentLinkInput {
  studentId: string;
  amount: number;
  description?: string;
  expiresInHours?: number;
}

export interface RecordManualPaymentInput {
  studentId: string;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "OTHER";
  paidAt?: string;
  notes?: string;
}
