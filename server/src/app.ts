import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "@/config/env.js";
import { authRouter } from "@/modules/auth/auth.routes.js";
import { branchesRouter } from "@/modules/branches/branches.routes.js";
import { usersRouter } from "@/modules/users/users.routes.js";
import { companiesRouter } from "@/modules/companies/companies.routes.js";
import { coursesRouter } from "@/modules/courses/courses.routes.js";
import { batchesRouter } from "@/modules/batches/batches.routes.js";
import { studentsRouter } from "@/modules/students/students.routes.js";
import { paymentsRouter, paymentsWebhookRouter } from "@/modules/payments/payments.routes.js";
import { discountsRouter } from "@/modules/discounts/discounts.routes.js";
import { reportsRouter } from "@/modules/reports/reports.routes.js";
import { auditRouter } from "@/modules/audit/audit.routes.js";
import { feeRemindersRouter } from "@/modules/feeReminders/feeReminders.routes.js";
import { targetsRouter } from "@/modules/targets/targets.routes.js";
import { leadsRouter } from "@/modules/leads/leads.routes.js";
import { backupRouter } from "@/modules/backup/backup.routes.js";
import { pettyCashRouter } from "@/modules/pettyCash/pettyCash.routes.js";
import { pettyCashRequisitionsRouter } from "@/modules/pettyCash/pettyCashRequisitions.routes.js";
import { revenueSharesRouter } from "@/modules/revenueShares/revenueShares.routes.js";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler.js";
import { UPLOADS_ROOT } from "@/middleware/upload.js";

export const app = express();

// Vite may fall back to a different port if its default is taken, so in
// development we accept any localhost origin rather than a fixed one.
const isLocalhostOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? (origin, callback) => callback(null, !origin || isLocalhostOrigin(origin))
        : env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(compression());
// Razorpay webhook signatures are computed over the raw request bytes, so we
// capture them here rather than giving that route its own body parser.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// Generous ceiling on the whole API; login has its own tighter limit below.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Student photos/ID proofs — served from a different port in dev, so relax CORP just for this path.
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOADS_ROOT),
);

app.use("/api/auth/login", authRateLimit);
app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/users", usersRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/batches", batchesRouter);
app.use("/api/students", studentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/discounts", discountsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/fee-reminders", feeRemindersRouter);
app.use("/api/targets", targetsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/backup", backupRouter);
app.use("/api/petty-cash", pettyCashRouter);
app.use("/api/petty-cash-requisitions", pettyCashRequisitionsRouter);
app.use("/api/revenue-shares", revenueSharesRouter);
app.use("/api/webhooks", paymentsWebhookRouter);

// Single-process deploy (Passenger/etc): this Node process serves the built React app
// too, not just the API — there's no separate static host in front of it in production.
if (env.NODE_ENV === "production") {
  const clientDist = path.join(import.meta.dirname, "../public");
  app.use(express.static(clientDist));
  // Client-side routing (React Router) needs every non-API, non-upload path to still
  // return index.html so a direct load/refresh on e.g. /students doesn't 404.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);
