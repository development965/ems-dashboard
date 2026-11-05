import { api } from "@/lib/api";
import type {
  FinanceDashboard,
  OutstandingReport,
  PlacementReport,
  ReceiptsReport,
  ReportSummary,
  RevenueConsole,
  RevenueReport,
  StudentReport,
} from "@/types/report";

/** `<input type="date">` gives "YYYY-MM-DD" in local time — construct explicitly rather than
 * `new Date(str)` (which parses as UTC midnight) to avoid an off-by-one-day near midnight. */
function toStartOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}
function toEndOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

function dateRangeParams(from?: string, to?: string): { from?: string; to?: string } {
  return {
    from: from ? toStartOfDayIso(from) : undefined,
    to: to ? toEndOfDayIso(to) : undefined,
  };
}

export async function fetchReportSummary(branchId?: string, from?: string, to?: string): Promise<ReportSummary> {
  const { data } = await api.get<ReportSummary>("/reports/summary", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}

export async function fetchFinanceDashboard(branchId?: string): Promise<FinanceDashboard> {
  const { data } = await api.get<FinanceDashboard>("/reports/finance", { params: branchId ? { branchId } : undefined });
  return data;
}

export async function fetchRevenueConsole(): Promise<RevenueConsole> {
  const { data } = await api.get<RevenueConsole>("/reports/revenue-console");
  return data;
}

export async function fetchRevenueReport(branchId?: string, from?: string, to?: string): Promise<RevenueReport> {
  const { data } = await api.get<RevenueReport>("/reports/revenue", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}

export async function fetchReceiptsReport(branchId?: string, from?: string, to?: string): Promise<ReceiptsReport> {
  const { data } = await api.get<ReceiptsReport>("/reports/receipts", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}

export async function fetchStudentReport(branchId?: string, from?: string, to?: string): Promise<StudentReport> {
  const { data } = await api.get<StudentReport>("/reports/students", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}

export async function fetchOutstandingReport(branchId?: string, from?: string, to?: string): Promise<OutstandingReport> {
  const { data } = await api.get<OutstandingReport>("/reports/outstanding", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}

export async function fetchPlacementReport(branchId?: string, from?: string, to?: string): Promise<PlacementReport> {
  const { data } = await api.get<PlacementReport>("/reports/placement", {
    params: { branchId: branchId || undefined, ...dateRangeParams(from, to) },
  });
  return data;
}
