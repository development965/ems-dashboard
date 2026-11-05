import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchOutstandingReport } from "@/lib/reportsApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableLoadingRow } from "@/components/Spinner";

// The same cutoff the Revenue Console's Outstanding KPI uses — anything enrolled before this
// is legacy-migrated data, kept separate here specifically so it can be inspected rather than
// just excluded, the way the dashboard widget does.
const CUTOFF = "2026-03-01";

type Cohort = "all" | "current" | "legacy";
type SortKey = "studentName" | "phone" | "branchName" | "courseName" | "netFee" | "paid" | "balanceDue" | "enrolledAt" | "cohort";
type SortDir = "asc" | "desc";

// Text columns read naturally A→Z on first click; numeric/date columns read naturally
// biggest/latest-first, since that's almost always what you're hunting for here.
const TEXT_SORT_KEYS: SortKey[] = ["studentName", "phone", "branchName", "courseName"];

export function OutstandingPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const [branchId, setBranchId] = useState("");
  const [cohort, setCohort] = useState<Cohort>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("balanceDue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const listRef = useRef<HTMLDivElement>(null);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(TEXT_SORT_KEYS.includes(key) ? "asc" : "desc");
    }
  };

  // Every clickable amount on this page — a summary tile or a per-branch cell — routes
  // through here: set the list below to match exactly what that number represents, then
  // scroll it into view so "click the amount" actually shows the students behind it.
  const drillInto = (nextBranchId: string, nextCohort: Cohort) => {
    setBranchId(nextBranchId);
    setCohort(nextCohort);
    setSearch("");
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: seesAllBranches });
  // Unfiltered by date on purpose — the whole point of this page is to see the before/after
  // split itself, not to pre-narrow it away like the dashboard widget does.
  const reportQuery = useQuery({
    queryKey: ["outstanding-report", branchId],
    queryFn: () => fetchOutstandingReport(branchId || undefined),
  });

  const rows = reportQuery.data?.students ?? [];

  const { legacyRows, currentRows } = useMemo(() => {
    const legacy = rows.filter((s) => s.enrolledAt < CUTOFF);
    const current = rows.filter((s) => s.enrolledAt >= CUTOFF);
    return { legacyRows: legacy, currentRows: current };
  }, [rows]);

  const sum = (list: typeof rows) => list.reduce((s, r) => s + r.balanceDue, 0);
  const totalOutstanding = sum(rows);
  const legacyOutstanding = sum(legacyRows);
  const currentOutstanding = sum(currentRows);

  const byBranch = useMemo(() => {
    const map = new Map<string, { branchName: string; legacy: number; current: number }>();
    for (const r of rows) {
      const entry = map.get(r.branchId) ?? { branchName: r.branchName, legacy: 0, current: 0 };
      if (r.enrolledAt < CUTOFF) entry.legacy += r.balanceDue;
      else entry.current += r.balanceDue;
      map.set(r.branchId, entry);
    }
    return [...map.entries()]
      .map(([branchId, v]) => ({ branchId, ...v, total: v.legacy + v.current }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const filtered = useMemo(() => {
    const pool = cohort === "legacy" ? legacyRows : cohort === "current" ? currentRows : rows;
    const term = search.trim().toLowerCase();
    if (!term) return pool;
    return pool.filter((s) => s.studentName.toLowerCase().includes(term) || s.phone.includes(term));
  }, [rows, legacyRows, currentRows, cohort, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "studentName":
          return a.studentName.localeCompare(b.studentName) * dir;
        case "phone":
          return a.phone.localeCompare(b.phone) * dir;
        case "branchName":
          return a.branchName.localeCompare(b.branchName) * dir;
        case "courseName":
          return a.courseName.localeCompare(b.courseName) * dir;
        case "netFee":
          return (a.netFee - b.netFee) * dir;
        case "paid":
          return (a.paid - b.paid) * dir;
        case "balanceDue":
          return (a.balanceDue - b.balanceDue) * dir;
        case "enrolledAt":
          return a.enrolledAt.localeCompare(b.enrolledAt) * dir;
        case "cohort":
          return ((a.enrolledAt < CUTOFF ? 0 : 1) - (b.enrolledAt < CUTOFF ? 0 : 1)) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Outstanding</h1>
        <p className="text-sm text-slate-500">
          Every rupee still owed, split by when the student enrolled — so legacy-migrated dues (before {CUTOFF}) can be told
          apart from genuinely current ones.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ClickableStat label="Total outstanding" value={totalOutstanding} loaded={!!reportQuery.data} tone="negative" onClick={() => drillInto(branchId, "all")} />
        <ClickableStat label="Since Mar 2026" value={currentOutstanding} loaded={!!reportQuery.data} tone="negative" onClick={() => drillInto(branchId, "current")} />
        <ClickableStat label="Legacy (before Mar 2026)" value={legacyOutstanding} loaded={!!reportQuery.data} onClick={() => drillInto(branchId, "legacy")} />
      </div>

      {seesAllBranches && byBranch.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Legacy (before Mar 2026)</th>
                <th className="px-4 py-3">Since Mar 2026</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byBranch.map((b) => (
                <tr key={b.branchId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{b.branchName}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => drillInto(b.branchId, "legacy")} className="text-slate-500 hover:text-brand-600 hover:underline">
                      {formatINR(b.legacy)}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => drillInto(b.branchId, "current")} className="text-red-600 hover:text-brand-600 hover:underline">
                      {formatINR(b.current)}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => drillInto(b.branchId, "all")} className="font-semibold text-slate-800 hover:text-brand-600 hover:underline">
                      {formatINR(b.total)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {seesAllBranches && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">All branches</option>
              {branchesQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Cohort</span>
          <select value={cohort} onChange={(e) => setCohort(e.target.value as Cohort)} className="input">
            <option value="all">All</option>
            <option value="current">Since Mar 2026</option>
            <option value="legacy">Legacy (before Mar 2026)</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone..." className="input" />
        </label>
        <ExportCsvButton
          filename={`outstanding-${cohort}`}
          headers={["Student", "Phone", "Branch", "Course", "Net fee", "Paid", "Balance due", "Enrolled", "Cohort"]}
          rows={sorted.map((s) => [
            s.studentName,
            s.phone,
            s.branchName,
            s.courseName,
            s.netFee,
            s.paid,
            s.balanceDue,
            new Date(s.enrolledAt).toLocaleDateString(),
            s.enrolledAt < CUTOFF ? "Legacy" : "Since Mar 2026",
          ])}
        />
      </div>

      <div ref={listRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white scroll-mt-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader label="Student" sortKey="studentName" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Phone" sortKey="phone" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              {seesAllBranches && <SortHeader label="Branch" sortKey="branchName" activeKey={sortKey} dir={sortDir} onSort={handleSort} />}
              <SortHeader label="Course" sortKey="courseName" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Net fee" sortKey="netFee" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Paid" sortKey="paid" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Balance due" sortKey="balanceDue" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Enrolled" sortKey="enrolledAt" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Cohort" sortKey="cohort" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportQuery.isLoading && <TableLoadingRow colSpan={seesAllBranches ? 9 : 8} />}
            {sorted.map((s) => {
              const isLegacy = s.enrolledAt < CUTOFF;
              return (
                <tr key={s.studentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link to={`/students/${s.studentId}`} target="_blank" rel="noreferrer" className="hover:underline">
                      {s.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.phone}</td>
                  {seesAllBranches && <td className="px-4 py-3 text-slate-500">{s.branchName}</td>}
                  <td className="px-4 py-3 text-slate-500">{s.courseName}</td>
                  <td className="px-4 py-3 text-slate-500">{formatINR(s.netFee)}</td>
                  <td className="px-4 py-3 text-green-700">{formatINR(s.paid)}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{formatINR(s.balanceDue)}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(s.enrolledAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLegacy ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isLegacy ? "Legacy" : "Since Mar 2026"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {reportQuery.isSuccess && sorted.length === 0 && (
              <tr>
                <td colSpan={seesAllBranches ? 9 : 8} className="px-4 py-6 text-center text-slate-400">
                  {search ? "No matches." : "No outstanding dues in this cohort."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Same look as StatTile, but a real button — click it and the student list below jumps to
 * exactly the rows that make up this number. */
function ClickableStat({
  label,
  value,
  loaded,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  loaded: boolean;
  tone?: "positive" | "negative";
  onClick: () => void;
}) {
  const toneClass = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-slate-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!loaded}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-white"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{loaded ? formatINR(value) : "—"}</p>
    </button>
  );
}

/** A `<th>` that doubles as a sort control — click to sort by this column, click again to
 * flip direction; the little arrow only shows on whichever column is currently active. */
function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 whitespace-nowrap hover:text-slate-700 ${isActive ? "text-slate-700" : ""}`}
      >
        {label}
        <span className={`text-[10px] ${isActive ? "" : "invisible"}`}>{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}
