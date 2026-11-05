import crypto from "node:crypto";
import { prisma } from "@/config/prisma.js";
import { env } from "@/config/env.js";
import { isRazorpayConfigured, razorpay } from "@/config/razorpay.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import { branchScopeFilter } from "@/middleware/rbac.js";
import { getStudentBalance } from "@/modules/students/students.service.js";
import { studentInScopeFilter } from "@/config/scope.js";
import type { CreatePaymentLinkInput, RecordManualPaymentInput } from "@/modules/payments/payments.schema.js";

async function getScopedStudent(user: AuthUser, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, companyId: user.companyId, ...branchScopeFilter(user) },
  });
  if (!student) throw new NotFoundError("Student not found");
  return student;
}

/**
 * Caps a requested amount to what's actually still owed, rather than rejecting it outright —
 * e.g. a student typed ₹999999 for a ₹23,600 balance ends up paying/getting linked ₹23,600.
 * Also counts any CREATED (unpaid, not yet expired/cancelled) payment links, so two links can't
 * both promise the same rupees before either is paid. Throws only when nothing is owed at all.
 */
async function resolveChargeableAmount(studentId: string, requestedAmount: number): Promise<number> {
  const [{ balanceDue }, pendingLinks] = await Promise.all([
    getStudentBalance(studentId),
    prisma.paymentLink.aggregate({
      where: { studentId, status: "CREATED" },
      _sum: { amount: true },
    }),
  ]);

  const pendingAmount = toMoney(pendingLinks._sum.amount ?? 0);
  const availableToCollect = balanceDue - pendingAmount;

  if (availableToCollect <= 0) {
    throw new ConflictError("This student has no outstanding balance to collect.");
  }

  return Math.min(requestedAmount, availableToCollect);
}

export async function listPaymentLinks(user: AuthUser, studentId?: string) {
  const links = await prisma.paymentLink.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...studentInScopeFilter,
      ...(studentId ? { studentId } : {}),
    },
    include: { student: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  });
  return links.map((link) => ({ ...link, amount: toMoney(link.amount) }));
}

export async function listPayments(user: AuthUser, studentId?: string) {
  const payments = await prisma.payment.findMany({
    where: {
      companyId: user.companyId,
      ...branchScopeFilter(user),
      ...studentInScopeFilter,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { select: { id: true, name: true, phone: true } },
      recordedBy: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { paidAt: "desc" },
  });
  return payments.map((payment) => ({ ...payment, amount: toMoney(payment.amount) }));
}

export async function createPaymentLink(user: AuthUser, input: CreatePaymentLinkInput) {
  if (!isRazorpayConfigured || !razorpay) {
    throw new AppError(
      "Razorpay isn't configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env to enable payment links.",
      503,
    );
  }

  const student = await getScopedStudent(user, input.studentId);
  const amount = await resolveChargeableAmount(student.id, input.amount);
  const expiresAt = input.expiresInHours ? new Date(Date.now() + input.expiresInHours * 3_600_000) : undefined;

  const razorpayLink = await razorpay.paymentLink.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    description: input.description ?? `Fee payment — ${student.name}`,
    customer: {
      name: student.name,
      contact: student.phone,
      ...(student.email ? { email: student.email } : {}),
    },
    notify: { sms: true, email: Boolean(student.email) },
    reminder_enable: true,
    notes: { studentId: student.id, branchId: student.branchId, companyId: student.companyId },
    ...(expiresAt ? { expire_by: Math.floor(expiresAt.getTime() / 1000) } : {}),
  });

  const link = await prisma.paymentLink.create({
    data: {
      companyId: student.companyId,
      branchId: student.branchId,
      studentId: student.id,
      amount,
      description: input.description,
      razorpayLinkId: razorpayLink.id,
      shortUrl: razorpayLink.short_url,
      createdById: user.id,
      expiresAt,
    },
  });
  return { ...link, amount: toMoney(link.amount) };
}

export async function cancelPaymentLink(user: AuthUser, paymentLinkId: string) {
  const existing = await prisma.paymentLink.findFirst({
    where: { id: paymentLinkId, companyId: user.companyId, ...branchScopeFilter(user) },
  });
  if (!existing) throw new NotFoundError("Payment link not found");
  if (existing.status !== "CREATED") {
    throw new ForbiddenError(`Cannot cancel a link that is already ${existing.status.toLowerCase()}`);
  }

  if (razorpay) {
    try {
      await razorpay.paymentLink.cancel(existing.razorpayLinkId);
    } catch (err) {
      // Razorpay can end up ahead of us — e.g. the link was cancelled/expired directly on
      // Razorpay's own dashboard, or a previous attempt cancelled it there but crashed before
      // our DB write landed. Either way, Razorpay already agrees the link shouldn't be payable;
      // treat that as success and sync our record instead of leaving it stuck on CREATED forever.
      const description = (err as { error?: { description?: string } })?.error?.description ?? "";
      const alreadyTerminal = /already (cancelled|expired)|cannot cancel or expire/i.test(description);
      if (!alreadyTerminal) throw err;
    }
  }

  const link = await prisma.paymentLink.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
  return { ...link, amount: toMoney(link.amount) };
}

export async function recordManualPayment(user: AuthUser, input: RecordManualPaymentInput) {
  const student = await getScopedStudent(user, input.studentId);
  const amount = await resolveChargeableAmount(student.id, input.amount);

  const payment = await prisma.payment.create({
    data: {
      companyId: student.companyId,
      branchId: student.branchId,
      studentId: student.id,
      amount,
      method: input.method,
      paidAt: input.paidAt ?? new Date(),
      recordedById: user.id,
      notes: input.notes,
    },
  });

  await logAudit({
    actor: user,
    branchId: student.branchId,
    action: "payment.recorded",
    entityType: "Payment",
    entityId: payment.id,
    summary: `Recorded ₹${toMoney(payment.amount)} (${input.method}) payment for ${student.name}`,
  });

  return { ...payment, amount: toMoney(payment.amount) };
}

/** Adds/edits a payment's remarks (e.g. a bank transaction ID) after the fact — same roles
 * that can record a payment in the first place, branch-scoped the same way. */
export async function updatePaymentNotes(user: AuthUser, paymentId: string, notes: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId: user.companyId, ...branchScopeFilter(user) },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { notes: notes || null },
  });

  await logAudit({
    actor: user,
    branchId: payment.branchId,
    action: "payment.notesUpdated",
    entityType: "Payment",
    entityId: payment.id,
    summary: notes ? `Updated remarks on a payment: ${notes}` : "Cleared remarks on a payment",
  });

  return { ...updated, amount: toMoney(updated.amount) };
}

/** Super-admin-only, and deliberately not exposed to anyone else — deleting a payment rewrites
 * a student's financial history rather than just reversing it, so it's reserved for genuine
 * data-entry corrections (duplicates, wrong student, etc.), not routine use. */
export async function deletePayment(user: AuthUser, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId: user.companyId },
    include: { student: { select: { id: true, name: true } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  await prisma.payment.delete({ where: { id: payment.id } });

  await logAudit({
    actor: user,
    branchId: payment.branchId,
    action: "payment.deleted",
    entityType: "Payment",
    entityId: payment.id,
    summary: `Deleted a ₹${toMoney(payment.amount)} (${payment.method}) payment for ${payment.student.name}`,
  });
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment_link?: { entity: { id: string; status: string } };
    payment?: { entity: { id: string; amount: number } };
  };
}

/** Idempotent: safe to receive the same event more than once (Razorpay retries on non-2xx). */
export async function handleRazorpayWebhook(payload: RazorpayWebhookPayload): Promise<void> {
  if (payload.event !== "payment_link.paid") return;

  const razorpayLinkId = payload.payload.payment_link?.entity.id;
  if (!razorpayLinkId) return;

  const link = await prisma.paymentLink.findUnique({ where: { razorpayLinkId } });
  if (!link || link.status === "PAID") return;

  await prisma.$transaction([
    prisma.paymentLink.update({ where: { id: link.id }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.payment.create({
      data: {
        companyId: link.companyId,
        branchId: link.branchId,
        studentId: link.studentId,
        amount: link.amount,
        method: "RAZORPAY_LINK",
        paymentLinkId: link.id,
        paidAt: new Date(),
        recordedById: link.createdById,
      },
    }),
  ]);
}
