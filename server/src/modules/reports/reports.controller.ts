import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { reportFiltersSchema } from "@/modules/reports/reports.schema.js";
import * as reportsService from "@/modules/reports/reports.service.js";

export const getSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = reportFiltersSchema.parse(req.query);
  const summary = await reportsService.getSummary(req.user!, filters);
  res.json(summary);
});

export const getFinanceDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const dashboard = await reportsService.getFinanceDashboard(req.user!, branchId);
  res.json(dashboard);
});

export const getRevenueConsoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const revenueConsole = await reportsService.getRevenueConsole(req.user!);
  res.json(revenueConsole);
});

export const getRevenueReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, from, to } = reportFiltersSchema.parse(req.query);
  const report = await reportsService.getRevenueReport(req.user!, from, to, branchId);
  res.json(report);
});

export const getReceiptsReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, from, to } = reportFiltersSchema.parse(req.query);
  const report = await reportsService.getReceiptsReport(req.user!, branchId, from, to);
  res.json(report);
});

export const getStudentReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, from, to } = reportFiltersSchema.parse(req.query);
  const report = await reportsService.getStudentReport(req.user!, branchId, from, to);
  res.json(report);
});

export const getOutstandingReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, from, to } = reportFiltersSchema.parse(req.query);
  const report = await reportsService.getOutstandingReport(req.user!, branchId, from, to);
  res.json(report);
});

export const getPlacementReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const { branchId, from, to } = reportFiltersSchema.parse(req.query);
  const report = await reportsService.getPlacementReport(req.user!, branchId, from, to);
  res.json(report);
});
