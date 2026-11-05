import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chart, type ChartConfiguration } from "chart.js/auto";
import { useEffect, useRef } from "react";
import { fetchReceiptsReport } from "@/lib/reportsApi";
import type { ReceiptsReport } from "@/types/report";
import { PageLoader } from "@/components/Spinner";
import "@/styles/revenueConsoleReplica.css";

/** Exact visual (AND behavioral) replica of the standalone Techmaax Revenue Console dashboard
 * (Consoildated_Revenue_File/techmaax-revenue-dashboard.html) — same fonts, palette, Chart.js
 * configs, and the same Branch/Month/YTD-range filtering, just fed by live data instead of a
 * manual upload. Filtering is deliberately per-widget-inconsistent, exactly like the original:
 * the matrix always shows everything, branch share respects month but not branch ("to show
 * context"), the monthly chart respects branch but not month, etc. — see each widget below. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PALETTE = ["#E8A00C", "#2A9D8F", "#5E7CE2", "#C75146", "#7D5BA6", "#1E7F4F", "#B97D06", "#3B4656", "#D46A9E", "#4CB8C4"];
const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
  RAZORPAY_LINK: "Razorpay",
  TRANSFER_IN: "Inter-branch transfer (in)",
  TRANSFER_OUT: "Inter-branch transfer (out)",
};

const fmtINR = (n: number) => "₹ " + Math.round(n).toLocaleString("en-IN");
const fmtINRs = (n: number) =>
  n >= 1e7 ? "₹" + (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? "₹" + (n / 1e5).toFixed(2) + " L" : "₹" + Math.round(n).toLocaleString("en-IN");
const mLabel = (k: string) => {
  const [y, m] = k.split("-");
  return `${MONTHS[+m - 1]} ${y}`;
};
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

Chart.defaults.font.family = "'Archivo', sans-serif";
Chart.defaults.color = "#3B4656";

function ChartCanvas({ config }: { config: ChartConfiguration<"bar" | "doughnut" | "line"> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return <canvas ref={canvasRef} />;
}

function heatBg(v: number, max: number): React.CSSProperties {
  if (!v) return {};
  const a = Math.max(0.08, Math.min(0.85, v / max));
  return { background: `rgba(232,160,12,${a.toFixed(2)})` };
}

type PaymentTxn = ReceiptsReport["rows"][number] & { month: string };
type DiscountTxn = ReceiptsReport["discountRows"][number] & { month: string };

/** `branchIds`, when given, narrows the whole console to just those branches (e.g. a
 * dashboard zone tab) before any of the console's own Branch/Month/YTD filtering runs —
 * everything below still behaves exactly like the replica it's matching.
 * `outstandingByBranch` feeds the Outstanding KPI — it's a live balance, not something a
 * receipts-only fetch here could derive, so the dashboard passes it in already zone-scoped. */
export function RevenueConsoleReplica({
  branchIds,
  outstandingByBranch,
}: {
  branchIds?: string[];
  outstandingByBranch?: { branchId: string; outstanding: number }[];
} = {}) {
  const query = useQuery({ queryKey: ["revenue-console-receipts"], queryFn: () => fetchReceiptsReport() });

  const [branchFilter, setBranchFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [ytdStart, setYtdStart] = useState("");
  const [ytdEnd, setYtdEnd] = useState("");

  const scopeBranchIds = branchIds ? new Set(branchIds) : null;

  const payments: PaymentTxn[] = useMemo(
    () =>
      (query.data?.rows ?? [])
        .filter((r) => !scopeBranchIds || scopeBranchIds.has(r.branchId))
        .map((r) => ({ ...r, month: monthKey(r.paidAt) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, branchIds?.join(",")],
  );
  const discounts: DiscountTxn[] = useMemo(
    () =>
      (query.data?.discountRows ?? [])
        .filter((r) => !scopeBranchIds || scopeBranchIds.has(r.branchId))
        .map((r) => ({ ...r, month: monthKey(r.createdAt) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, branchIds?.join(",")],
  );

  // If the scope narrows (e.g. switching dashboard zone tabs) and the console's own branch
  // dropdown was pointed at a branch that's no longer in scope, drop back to "all branches"
  // rather than silently showing empty data for a branch you can't even select any more.
  useEffect(() => {
    setBranchFilter((current) => (current && scopeBranchIds && !scopeBranchIds.has(current) ? "" : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds?.join(",")]);

  const allMonths = useMemo(() => [...new Set(payments.map((p) => p.month))].sort(), [payments]);
  const allBranches = useMemo(
    () => [...new Map(payments.map((p) => [p.branchId, p.branchName])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    [payments],
  );

  const effectiveYtdStart = ytdStart || allMonths[0] || "";
  const effectiveYtdEnd = ytdEnd || allMonths[allMonths.length - 1] || "";

  // Branch + month scoped — feeds the top-3 KPIs, payment-method chart, top-courses table.
  const scopedPayments = useMemo(
    () => payments.filter((p) => (!branchFilter || p.branchId === branchFilter) && (!monthFilter || p.month === monthFilter)),
    [payments, branchFilter, monthFilter],
  );
  const scopedDiscounts = useMemo(
    () => discounts.filter((d) => (!branchFilter || d.branchId === branchFilter) && (!monthFilter || d.month === monthFilter)),
    [discounts, branchFilter, monthFilter],
  );

  // Branch scoped only, never month — outstanding is a live balance as of today, not
  // something that happened "in" a given month, so the month filter doesn't apply to it.
  const outstandingInScope = useMemo(() => {
    const rows = branchFilter ? (outstandingByBranch ?? []).filter((r) => r.branchId === branchFilter) : (outstandingByBranch ?? []);
    return rows.reduce((sum, r) => sum + r.outstanding, 0);
  }, [outstandingByBranch, branchFilter]);

  // Branch + YTD-range scoped (NOT month) — feeds YTD revenue KPI, cumulative line, YTD table.
  const ytdPayments = useMemo(
    () => payments.filter((p) => p.month >= effectiveYtdStart && p.month <= effectiveYtdEnd && (!branchFilter || p.branchId === branchFilter)),
    [payments, branchFilter, effectiveYtdStart, effectiveYtdEnd],
  );
  const ytdDiscounts = useMemo(
    () => discounts.filter((d) => d.month >= effectiveYtdStart && d.month <= effectiveYtdEnd && (!branchFilter || d.branchId === branchFilter)),
    [discounts, branchFilter, effectiveYtdStart, effectiveYtdEnd],
  );

  const sum = <T,>(arr: T[], pick: (t: T) => number) => arr.reduce((s, t) => s + pick(t), 0);
  const bColor = (i: number) => PALETTE[i % PALETTE.length];

  if (query.isLoading) return <PageLoader label="Loading revenue console…" />;
  if (!query.data || payments.length === 0) return null;

  const revenueInScope = sum(scopedPayments, (p) => p.amount);
  // "Receipts" means customer receipts — transfer rows are real money but not a receipt from
  // a customer, so they're excluded from the count (and thus the avg-per-receipt figure) even
  // though they do count toward revenueInScope above.
  const scopedReceiptCount = scopedPayments.filter((p) => p.method !== "TRANSFER_IN" && p.method !== "TRANSFER_OUT").length;
  const ytdRevenue = sum(ytdPayments, (p) => p.amount);
  const scopeLabel = `${branchFilter ? allBranches.find((b) => b.id === branchFilter)?.name : "All branches"} · ${monthFilter ? mLabel(monthFilter) : "all months"}`;

  // ---- Monthly revenue by branch: respects branch filter, NOT month — always all months ----
  const monthlyBranches = branchFilter ? allBranches.filter((b) => b.id === branchFilter) : allBranches;
  const monthlyConfig: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: allMonths.map(mLabel),
      datasets: monthlyBranches.map((b) => ({
        label: b.name,
        backgroundColor: bColor(allBranches.findIndex((x) => x.id === b.id)),
        borderRadius: 4,
        data: allMonths.map((m) => sum(payments.filter((p) => p.branchId === b.id && p.month === m), (p) => p.amount)),
      })),
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => fmtINRs(Number(v)) }, grid: { color: "#EEEBE2" } } },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtINR(c.parsed.y ?? 0)}` } },
      },
    },
  };

  // ---- Branch share: respects month filter, ignores branch filter ("to show context") ----
  const shareTxns = monthFilter ? payments.filter((p) => p.month === monthFilter) : payments;
  const shareByBranch = allBranches.map((b) => sum(shareTxns.filter((p) => p.branchId === b.id), (p) => p.amount));
  const shareTotal = shareByBranch.reduce((s, v) => s + v, 0) || 1;
  const shareConfig: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: { labels: allBranches.map((b) => b.name), datasets: [{ data: shareByBranch, backgroundColor: allBranches.map((_, i) => bColor(i)), borderColor: "#fff", borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtINR(Number(c.parsed))} (${((100 * Number(c.parsed)) / shareTotal).toFixed(1)}%)` } },
      },
    },
  };

  // ---- YTD cumulative: respects branch filter + YTD range ----
  const ytdMonths = allMonths.filter((m) => m >= effectiveYtdStart && m <= effectiveYtdEnd);
  const lineBranches = branchFilter ? allBranches.filter((b) => b.id === branchFilter) : allBranches;
  const ytdDatasets: ChartConfiguration<"line">["data"]["datasets"] = lineBranches.map((b) => {
    let acc = 0;
    return {
      label: b.name,
      borderColor: bColor(allBranches.findIndex((x) => x.id === b.id)),
      backgroundColor: bColor(allBranches.findIndex((x) => x.id === b.id)),
      tension: 0.25,
      pointRadius: 3,
      data: ytdMonths.map((m) => (acc += sum(payments.filter((p) => p.branchId === b.id && p.month === m), (p) => p.amount))),
    };
  });
  if (!branchFilter && allBranches.length > 1) {
    let acc = 0;
    ytdDatasets.push({
      label: "All branches",
      borderColor: "#1B2430",
      backgroundColor: "#1B2430",
      borderWidth: 2.5,
      borderDash: [6, 4],
      tension: 0.25,
      pointRadius: 0,
      data: ytdMonths.map((m) => (acc += sum(payments.filter((p) => p.month === m), (p) => p.amount))),
    });
  }
  const ytdChartConfig: ChartConfiguration<"line"> = {
    type: "line",
    data: { labels: ytdMonths.map(mLabel), datasets: ytdDatasets },
    options: {
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: (v) => fmtINRs(Number(v)) }, grid: { color: "#EEEBE2" } }, x: { grid: { display: false } } },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtINR(c.parsed.y ?? 0)} cumulative` } },
      },
    },
  };

  // ---- Payment method split: branch + month scoped. TRANSFER_OUT is a negative amount (money
  // leaving), which a pie/doughnut slice can't represent — it's excluded here specifically,
  // even though it's included everywhere else (KPIs, monthly/branch/YTD figures, the matrix).
  const methodKeys = [...new Set(scopedPayments.filter((p) => p.method !== "TRANSFER_OUT").map((p) => p.method))];
  const payConfig: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: methodKeys.map((m) => METHOD_LABELS[m] ?? m),
      datasets: [{ data: methodKeys.map((m) => sum(scopedPayments.filter((p) => p.method === m), (p) => p.amount)), backgroundColor: methodKeys.map((_, i) => PALETTE[(i + 4) % PALETTE.length]), borderColor: "#fff", borderWidth: 2 }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtINR(Number(c.parsed))}` } },
      },
    },
  };

  // ---- Branch × month matrix: never filtered — always the full picture ----
  const matrixMax = Math.max(...allBranches.flatMap((b) => allMonths.map((m) => sum(payments.filter((p) => p.branchId === b.id && p.month === m), (p) => p.amount))), 1);
  const colTotals = allMonths.map((m) => sum(payments.filter((p) => p.month === m), (p) => p.amount));
  const grandTotal = sum(payments, (p) => p.amount);

  // ---- YTD table: branch filter + YTD range (not month) ----
  const ytdTableBranches = branchFilter ? allBranches.filter((b) => b.id === branchFilter) : allBranches;
  const ytdTableTotal = ytdRevenue || 1;

  // ---- Top courses: branch + month scoped ----
  const courseNames = [...new Set(scopedPayments.map((p) => p.courseName))];
  const topCourses = courseNames
    .map((name) => ({
      name,
      revenue: sum(scopedPayments.filter((p) => p.courseName === name), (p) => p.amount),
      receipts: scopedPayments.filter((p) => p.courseName === name).length,
      discount: sum(scopedDiscounts.filter((d) => d.courseName === name), (d) => d.amount),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  return (
    <div className="rc-replica">
      <div className="rc-header">
        <h2>TechMaax Revenue Console</h2>
        <span className="rc-sub">Consolidated receipts · branch &amp; month analytics · YTD tracking</span>
        <span className="rc-badge">
          {allBranches.length} branch{allBranches.length === 1 ? "" : "es"} · Live
        </span>
      </div>

      <section className="rc-card">
        <div className="rc-card-h">
          <h3>Scope</h3>
          <span className="rc-hint">KPIs, charts and tables below follow this scope. Set YTD start/end to build year-to-date figures.</span>
        </div>
        <div className="rc-card-b rc-filters">
          <div className="rc-field">
            <label htmlFor="rcBranch">Branch</label>
            <select id="rcBranch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rc-field">
            <label htmlFor="rcMonth">Month</label>
            <select id="rcMonth" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">All months</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {mLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="rc-field">
            <label htmlFor="rcYtdStart">YTD start month</label>
            <select id="rcYtdStart" value={effectiveYtdStart} onChange={(e) => setYtdStart(e.target.value)}>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {mLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="rc-field">
            <label htmlFor="rcYtdEnd">YTD end month</label>
            <select id="rcYtdEnd" value={effectiveYtdEnd} onChange={(e) => setYtdEnd(e.target.value)}>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {mLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rc-btn"
            onClick={() => {
              setBranchFilter("");
              setMonthFilter("");
              setYtdStart("");
              setYtdEnd("");
            }}
          >
            Reset filters
          </button>
        </div>
      </section>

      <section className="rc-kpis">
        <div className="rc-kpi">
          <div className="rc-lab">Revenue collected</div>
          <div className="rc-val">{fmtINRs(revenueInScope)}</div>
          <div className="rc-note">{scopeLabel}</div>
        </div>
        <div className="rc-kpi rc-k2">
          <div className="rc-lab">Receipts</div>
          <div className="rc-val">{scopedReceiptCount.toLocaleString("en-IN")}</div>
          <div className="rc-note">{scopedReceiptCount ? `avg ${fmtINRs(revenueInScope / scopedReceiptCount)} / receipt` : ""}</div>
        </div>
        <div className="rc-kpi rc-k3">
          <div className="rc-lab">Outstanding</div>
          <div className="rc-val">{fmtINRs(outstandingInScope)}</div>
          <div className="rc-note">{branchFilter ? allBranches.find((b) => b.id === branchFilter)?.name : "All branches"} · since Mar 2026</div>
        </div>
        <div className="rc-kpi rc-k4">
          <div className="rc-lab">YTD revenue</div>
          <div className="rc-val">{fmtINRs(ytdRevenue)}</div>
          <div className="rc-note">
            {mLabel(effectiveYtdStart)} → {mLabel(effectiveYtdEnd)}
            {branchFilter ? ` · ${allBranches.find((b) => b.id === branchFilter)?.name}` : ""}
          </div>
        </div>
      </section>

      <section className="rc-grid2">
        <div className="rc-card">
          <div className="rc-card-h">
            <h3>Monthly revenue by branch</h3>
          </div>
          <div className="rc-card-b rc-chartbox rc-tall">
            <ChartCanvas config={monthlyConfig} />
          </div>
        </div>
        <div className="rc-card">
          <div className="rc-card-h">
            <h3>Branch share</h3>
            <span className="rc-pill">{monthFilter ? mLabel(monthFilter) : "all months"}</span>
          </div>
          <div className="rc-card-b rc-chartbox rc-tall">
            <ChartCanvas config={shareConfig} />
          </div>
        </div>
      </section>

      <section className="rc-grid2b">
        <div className="rc-card">
          <div className="rc-card-h">
            <h3>YTD cumulative revenue</h3>
          </div>
          <div className="rc-card-b rc-chartbox">
            <ChartCanvas config={ytdChartConfig} />
          </div>
        </div>
        <div className="rc-card">
          <div className="rc-card-h">
            <h3>Payment method split</h3>
            <span className="rc-pill">{scopeLabel}</span>
          </div>
          <div className="rc-card-b rc-chartbox">
            <ChartCanvas config={payConfig} />
          </div>
        </div>
      </section>

      <section className="rc-card">
        <div className="rc-card-h">
          <h3>Branch × month revenue matrix</h3>
          <span className="rc-sub">Darker amber = higher revenue. Totals in the outer row/column. Always shows everything, regardless of scope above.</span>
        </div>
        <div className="rc-card-b rc-tblwrap">
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                {allMonths.map((m) => (
                  <th key={m}>{mLabel(m)}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {allBranches.map((b) => {
                const rowTotal = sum(payments.filter((p) => p.branchId === b.id), (p) => p.amount);
                return (
                  <tr key={b.id}>
                    <td className="rc-rowhead">{b.name}</td>
                    {allMonths.map((m) => {
                      const v = sum(payments.filter((p) => p.branchId === b.id && p.month === m), (p) => p.amount);
                      return (
                        <td key={`${b.id}-${m}`} className="rc-heat" style={heatBg(v, matrixMax)}>
                          {v ? fmtINRs(v) : <span className="rc-zero">–</span>}
                        </td>
                      );
                    })}
                    <td className="rc-rowhead">{fmtINRs(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>All branches</td>
                {colTotals.map((v, i) => (
                  <td key={allMonths[i]}>{fmtINRs(v)}</td>
                ))}
                <td>{fmtINRs(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rc-card">
        <div className="rc-card-h">
          <h3>YTD summary by branch</h3>
          <span className="rc-pill">
            {mLabel(effectiveYtdStart)} → {mLabel(effectiveYtdEnd)}
          </span>
        </div>
        <div className="rc-card-b rc-tblwrap">
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Receipts</th>
                <th>Discount</th>
                <th>Revenue (paid)</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {ytdTableBranches.map((b) => {
                const rows = ytdPayments.filter((p) => p.branchId === b.id);
                const disc = sum(ytdDiscounts.filter((d) => d.branchId === b.id), (d) => d.amount);
                const revenue = sum(rows, (p) => p.amount);
                return (
                  <tr key={b.id}>
                    <td className="rc-rowhead">{b.name}</td>
                    <td>{rows.length}</td>
                    <td>{fmtINRs(disc)}</td>
                    <td className="rc-rowhead">{fmtINRs(revenue)}</td>
                    <td>{((100 * revenue) / ytdTableTotal).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{ytdPayments.length}</td>
                <td>{fmtINRs(sum(ytdDiscounts, (d) => d.amount))}</td>
                <td>{fmtINRs(ytdRevenue)}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rc-card">
        <div className="rc-card-h">
          <h3>Top courses by revenue</h3>
          <span className="rc-pill">{scopeLabel}</span>
        </div>
        <div className="rc-card-b rc-tblwrap">
          <table>
            <thead>
              <tr>
                <th>Course / class</th>
                <th>Receipts</th>
                <th>Discount</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topCourses.map((row) => (
                <tr key={row.name}>
                  <td className="rc-rowhead">{row.name}</td>
                  <td>{row.receipts}</td>
                  <td>{fmtINRs(row.discount)}</td>
                  <td className="rc-rowhead">{fmtINRs(row.revenue)}</td>
                </tr>
              ))}
              {topCourses.length === 0 && (
                <tr>
                  <td colSpan={4} className="rc-zero" style={{ textAlign: "center", padding: "20px" }}>
                    No revenue in this scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
