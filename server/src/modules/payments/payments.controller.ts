import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { createPaymentLinkSchema, recordManualPaymentSchema, updatePaymentNotesSchema } from "@/modules/payments/payments.schema.js";
import * as paymentsService from "@/modules/payments/payments.service.js";

export const listPaymentLinksHandler = asyncHandler(async (req: Request, res: Response) => {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const paymentLinks = await paymentsService.listPaymentLinks(req.user!, studentId);
  res.json({ paymentLinks });
});

export const listPaymentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const payments = await paymentsService.listPayments(req.user!, studentId);
  res.json({ payments });
});

export const createPaymentLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createPaymentLinkSchema.parse(req.body);
  const paymentLink = await paymentsService.createPaymentLink(req.user!, input);
  res.status(201).json({ paymentLink });
});

export const cancelPaymentLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const paymentLink = await paymentsService.cancelPaymentLink(req.user!, req.params.id);
  res.json({ paymentLink });
});

export const recordManualPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = recordManualPaymentSchema.parse(req.body);
  const payment = await paymentsService.recordManualPayment(req.user!, input);
  res.status(201).json({ payment });
});

export const updatePaymentNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updatePaymentNotesSchema.parse(req.body);
  const payment = await paymentsService.updatePaymentNotes(req.user!, req.params.id, input.notes);
  res.json({ payment });
});

export const deletePaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  await paymentsService.deletePayment(req.user!, req.params.id);
  res.status(204).end();
});

export const razorpayWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"];
  const isValid = paymentsService.verifyRazorpayWebhookSignature(
    req.rawBody ?? Buffer.from(""),
    typeof signature === "string" ? signature : undefined,
  );

  if (!isValid) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  await paymentsService.handleRazorpayWebhook(req.body);
  res.status(200).json({ received: true });
});
