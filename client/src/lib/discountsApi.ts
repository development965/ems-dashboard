import { api } from "@/lib/api";
import type { CreateDiscountInput, Discount } from "@/types/discount";

export async function fetchDiscounts(studentId?: string): Promise<Discount[]> {
  const { data } = await api.get<{ discounts: Discount[] }>("/discounts", { params: studentId ? { studentId } : undefined });
  return data.discounts;
}

export async function createDiscount(input: CreateDiscountInput): Promise<Discount> {
  const { data } = await api.post<{ discount: Discount }>("/discounts", input);
  return data.discount;
}
