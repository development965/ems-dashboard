import { api } from "@/lib/api";
import type { CreatePaymentLinkInput, Payment, PaymentLink, RecordManualPaymentInput } from "@/types/payment";

export async function fetchPaymentLinks(studentId?: string): Promise<PaymentLink[]> {
  const { data } = await api.get<{ paymentLinks: PaymentLink[] }>("/payments/links", {
    params: studentId ? { studentId } : undefined,
  });
  return data.paymentLinks;
}

export async function fetchPayments(studentId?: string): Promise<Payment[]> {
  const { data } = await api.get<{ payments: Payment[] }>("/payments", { params: studentId ? { studentId } : undefined });
  return data.payments;
}

export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
  const { data } = await api.post<{ paymentLink: PaymentLink }>("/payments/links", input);
  return data.paymentLink;
}

export async function cancelPaymentLink(id: string): Promise<PaymentLink> {
  const { data } = await api.post<{ paymentLink: PaymentLink }>(`/payments/links/${id}/cancel`);
  return data.paymentLink;
}

export async function recordManualPayment(input: RecordManualPaymentInput): Promise<Payment> {
  const { data } = await api.post<{ payment: Payment }>("/payments", input);
  return data.payment;
}

/** Super-admin-only — permanently deletes a payment record. */
export async function deletePayment(id: string): Promise<void> {
  await api.delete(`/payments/${id}`);
}

/** Adds/edits a payment's remarks (e.g. a bank transaction ID) after the fact. */
export async function updatePaymentNotes(id: string, notes: string): Promise<Payment> {
  const { data } = await api.patch<{ payment: Payment }>(`/payments/${id}/notes`, { notes });
  return data.payment;
}
