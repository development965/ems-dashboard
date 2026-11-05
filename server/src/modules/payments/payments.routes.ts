import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import { requireRole } from "@/middleware/rbac.js";
import {
  cancelPaymentLinkHandler,
  createPaymentLinkHandler,
  deletePaymentHandler,
  listPaymentLinksHandler,
  listPaymentsHandler,
  razorpayWebhookHandler,
  recordManualPaymentHandler,
  updatePaymentNotesHandler,
} from "@/modules/payments/payments.controller.js";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

const feeCollectorRoles = ["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"] as const;

paymentsRouter.get("/links", requireRole(...feeCollectorRoles), listPaymentLinksHandler);
paymentsRouter.post("/links", requireRole(...feeCollectorRoles), createPaymentLinkHandler);
paymentsRouter.post("/links/:id/cancel", requireRole(...feeCollectorRoles), cancelPaymentLinkHandler);

paymentsRouter.get("/", requireRole(...feeCollectorRoles), listPaymentsHandler);
paymentsRouter.post("/", requireRole(...feeCollectorRoles), recordManualPaymentHandler);

// Remarks (e.g. a transaction ID) can be added or edited after the fact — same roles as
// recording the payment in the first place.
paymentsRouter.patch("/:id/notes", requireRole(...feeCollectorRoles), updatePaymentNotesHandler);

// Deleting a payment rewrites financial history — reserved for super admins only.
paymentsRouter.delete("/:id", requireRole("SUPER_ADMIN"), deletePaymentHandler);

// Unauthenticated — called by Razorpay's servers, verified via HMAC signature instead. Mounted separately in app.ts.
export const paymentsWebhookRouter = Router();
paymentsWebhookRouter.post("/razorpay", razorpayWebhookHandler);
