import { Router } from "express";
import { authenticate } from "@/middleware/auth.js";
import {
  getFinanceDashboardHandler,
  getOutstandingReportHandler,
  getPlacementReportHandler,
  getReceiptsReportHandler,
  getRevenueConsoleHandler,
  getRevenueReportHandler,
  getStudentReportHandler,
  getSummaryHandler,
} from "@/modules/reports/reports.controller.js";

export const reportsRouter = Router();

reportsRouter.use(authenticate);

reportsRouter.get("/summary", getSummaryHandler);
reportsRouter.get("/finance", getFinanceDashboardHandler);
reportsRouter.get("/revenue-console", getRevenueConsoleHandler);
reportsRouter.get("/revenue", getRevenueReportHandler);
reportsRouter.get("/receipts", getReceiptsReportHandler);
reportsRouter.get("/students", getStudentReportHandler);
reportsRouter.get("/outstanding", getOutstandingReportHandler);
reportsRouter.get("/placement", getPlacementReportHandler);
