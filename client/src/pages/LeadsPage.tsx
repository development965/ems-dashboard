import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AxiosError } from "axios";
import { createLead, fetchLeadFunnel, fetchLeads } from "@/lib/leadsApi";
import { fetchCourses } from "@/lib/coursesApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { StatTile } from "@/components/charts/StatTile";
import { TableLoadingRow } from "@/components/Spinner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import type { LeadSource, LeadStatus } from "@/types/lead";

const sources: LeadSource[] = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "OTHER"];
const statuses: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "TRIAL_SCHEDULED", "CONVERTED", "LOST"];

const STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  INTERESTED: "bg-purple-100 text-purple-700",
  TRIAL_SCHEDULED: "bg-indigo-100 text-indigo-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-slate-100 text-slate-500",
};

export function LeadsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = canSeeAllBranches(user?.role);
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: isSuperAdmin });
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  // The tiles follow the branch + date filters, so they always describe the same leads as the table's period.
  const funnelQuery = useQuery({
    queryKey: ["lead-funnel", branchId, from, to],
    queryFn: () => fetchLeadFunnel({ branchId: branchId || undefined, from: from || undefined, to: to || undefined }),
  });
  const leadsQuery = useQuery({
    queryKey: ["leads", branchId, status, search, from, to],
    queryFn: () =>
      fetchLeads({
        branchId: branchId || undefined,
        status: status || undefined,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("WALK_IN");
  const [sourceDetail, setSourceDetail] = useState("");
  const [interestedCourseId, setInterestedCourseId] = useState("");
  const [formBranchId, setFormBranchId] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createLead({
        name,
        phone,
        email: email || undefined,
        source,
        sourceDetail: source === "OTHER" ? sourceDetail || undefined : undefined,
        interestedCourseId: interestedCourseId || undefined,
        branchId: isSuperAdmin ? formBranchId : undefined,
      }),
    onSuccess: () => {
      setName("");
      setPhone("");
      setEmail("");
      setSourceDetail("");
      setInterestedCourseId("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
    },
  });

  const createError =
    createMutation.isError && ((createMutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to add lead");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const funnel = funnelQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">Enquiries and walk-ins, before they become students.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + Add lead
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Total leads" value={funnel?.total ?? "—"} />
        <StatTile label="Open" value={funnel?.open ?? "—"} />
        <StatTile label="Converted" value={funnel?.converted ?? "—"} tone="positive" />
        <StatTile label="Lost" value={funnel?.lost ?? "—"} tone="negative" />
        <StatTile label="Conversion rate" value={funnel?.conversionRatePct !== null && funnel?.conversionRatePct !== undefined ? `${funnel.conversionRatePct}%` : "—"} />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="input" />
          </Field>
          <Field label="Email (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className="input">
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          {source === "OTHER" && (
            <Field label="Describe the source">
              <input
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                placeholder="e.g. Event, flyer, alumni referral..."
                className="input"
              />
            </Field>
          )}
          <Field label="Interested course (optional)">
            <select value={interestedCourseId} onChange={(e) => setInterestedCourseId(e.target.value)} className="input">
              <option value="">Not decided yet</option>
              {coursesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {isSuperAdmin && (
            <Field label="Branch">
              <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} required className="input">
                <option value="" disabled>
                  Select branch
                </option>
                {branchesQuery.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="col-span-full flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Add lead
            </button>
            {createError && <span className="text-sm text-red-600">{createError}</span>}
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {isSuperAdmin && (
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
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone..." className="input" />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Interested in</th>
              {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leadsQuery.isLoading && <TableLoadingRow colSpan={isSuperAdmin ? 7 : 6} />}
            {leadsQuery.data?.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link to={`/leads/${l.id}`} className="hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{l.phone}</td>
                <td className="px-4 py-3 text-slate-500">
                  {l.source.replace("_", " ")}
                  {l.source === "OTHER" && l.sourceDetail && <span className="text-xs text-slate-400"> — {l.sourceDetail}</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{l.interestedCourse?.name ?? "—"}</td>
                {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{l.branch.name}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[l.status]}`}>
                    {l.status.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
            {leadsQuery.isSuccess && leadsQuery.data.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-slate-400">
                  {search || status || branchId || from || to ? "No leads match your filters." : "No leads yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
