export interface Discount {
  id: string;
  studentId: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  student: { id: string; name: string; phone: string };
  approvedBy: { id: string; name: string };
}

export interface CreateDiscountInput {
  studentId: string;
  amount: number;
  reason?: string;
}
