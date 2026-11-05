import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { addLeadActivity, convertLead, fetchLead, updateLead } from "@/lib/leadsApi";
import { fetchCourses } from "@/lib/coursesApi";
import { fetchBatches } from "@/lib/batchesApi";
import { formatINR } from "@/lib/format";
import { PageLoader } from "@/components/Spinner";
import type { CourseMode } from "@/types/course";
import type { LeadSource, LeadStatus } from "@/types/lead";

const statuses: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "TRIAL_SCHEDULED", "CONVERTED", "LOST"];
const sources: LeadSource[] = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "OTHER"];
const modes: CourseMode[] = ["ONLINE", "OFFLINE", "HYBRID"];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const leadQuery = useQuery({ queryKey: ["lead", id], queryFn: () => fetchLead(id!), enabled: Boolean(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lead", id] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
  };

  if (leadQuery.isLoading) return <PageLoader />;
  if (leadQuery.isError || !leadQuery.data) return <p className="text-sm text-red-600">Lead not found.</p>;

  const lead = leadQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
          <p className="text-sm text-slate-500">
            {lead.phone} · {lead.branch.name} · {lead.source.replace("_", " ")}
            {lead.source === "OTHER" && lead.sourceDetail && ` (${lead.sourceDetail})`}
          </p>
        </div>
        <Link to="/leads" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to leads
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <LeadProfileForm lead={lead} onSaved={invalidate} />
          <ActivityTimeline leadId={lead.id} activities={lead.activities ?? []} onAdded={invalidate} />
        </div>
        <div className="flex flex-col gap-6">
          {lead.status === "CONVERTED" ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <h2 className="mb-2 font-semibold text-green-900">Converted</h2>
              <p className="text-sm text-green-800">
                This lead is now a student.{" "}
                {lead.convertedStudent && (
                  <Link to={`/students/${lead.convertedStudent.id}`} className="font-medium underline">
                    View profile →
                  </Link>
                )}
              </p>
            </div>
          ) : lead.status === "LOST" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="mb-2 font-semibold text-slate-700">Lost</h2>
              <p className="text-sm text-slate-500">{lead.lostReason || "No reason given."}</p>
            </div>
          ) : (
            <ConvertForm lead={lead} onConverted={invalidate} />
          )}
        </div>
      </div>
    </div>
  );
}

function LeadProfileForm({
  lead,
  onSaved,
}: {
  lead: import("@/types/lead").Lead;
  onSaved: () => void;
}) {
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email ?? "");
  const [source, setSource] = useState<LeadSource>(lead.source);
  const [sourceDetail, setSourceDetail] = useState(lead.sourceDetail ?? "");
  const [interestedCourseId, setInterestedCourseId] = useState(lead.interestedCourseId ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateLead(lead.id, {
        name,
        phone,
        email: email || undefined,
        source,
        sourceDetail: source === "OTHER" ? sourceDetail || undefined : undefined,
        interestedCourseId: interestedCourseId || null,
        status,
        lostReason: status === "LOST" ? lostReason || undefined : undefined,
        notes: notes || undefined,
      }),
    onSuccess: onSaved,
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to save");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  const disabled = lead.status === "CONVERTED";

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Profile</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required disabled={disabled} className="input" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={disabled} className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} className="input" />
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} disabled={disabled} className="input">
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
              disabled={disabled}
              className="input"
            />
          </Field>
        )}
        <Field label="Interested course">
          <select
            value={interestedCourseId}
            onChange={(e) => setInterestedCourseId(e.target.value)}
            disabled={disabled}
            className="input"
          >
            <option value="">Not decided yet</option>
            {coursesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} disabled={disabled} className="input">
            {statuses
              .filter((s) => s !== "CONVERTED")
              .map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
          </select>
        </Field>
        {status === "LOST" && (
          <Field label="Lost reason">
            <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="input" />
          </Field>
        )}
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} className="input" />
        </Field>
      </div>
      {!disabled && (
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Save changes
        </button>
      )}
      {mutation.isSuccess && <span className="ml-3 text-sm text-green-700">Saved.</span>}
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}

function ActivityTimeline({
  leadId,
  activities,
  onAdded,
}: {
  leadId: string;
  activities: import("@/types/lead").LeadActivity[];
  onAdded: () => void;
}) {
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => addLeadActivity(leadId, note),
    onSuccess: () => {
      setNote("");
      onAdded();
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (note.trim()) mutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Activity</h2>
      <form onSubmit={handleSubmit} className="mb-4 flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Log a call, note, or follow-up</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called, said they'd decide by Friday..." className="input" />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending || !note.trim()}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Log
        </button>
      </form>
      <div className="flex flex-col gap-3">
        {activities.map((a) => (
          <div key={a.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
            <p className="text-slate-700">{a.note}</p>
            <p className="text-xs text-slate-400">
              {a.createdBy.name} · {new Date(a.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
        {activities.length === 0 && <p className="text-sm text-slate-400">No activity logged yet.</p>}
      </div>
    </div>
  );
}

function ConvertForm({ lead, onConverted }: { lead: import("@/types/lead").Lead; onConverted: () => void }) {
  const navigate = useNavigate();
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const batchesQuery = useQuery({ queryKey: ["batches"], queryFn: () => fetchBatches() });

  const [courseId, setCourseId] = useState(lead.interestedCourseId ?? "");
  const [batchId, setBatchId] = useState("");
  const [mode, setMode] = useState<CourseMode>("OFFLINE");
  const [totalFee, setTotalFee] = useState("");
  const [location, setLocation] = useState("");

  const selectedCourse = coursesQuery.data?.find((c) => c.id === courseId);
  const batchesForCourse = useMemo(
    () => batchesQuery.data?.filter((b) => b.courseId === courseId && b.branchId === lead.branchId) ?? [],
    [batchesQuery.data, courseId, lead.branchId],
  );

  const mutation = useMutation({
    mutationFn: () =>
      convertLead(lead.id, {
        courseId,
        batchId: batchId || undefined,
        mode,
        totalFee: Number(totalFee),
        location,
      }),
    onSuccess: (student) => {
      onConverted();
      navigate(`/students/${student.id}`, { replace: true });
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to convert lead");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  const applyFeeFromStructure = (feeId: string) => {
    const fee = selectedCourse?.feeStructures.find((f) => f.id === feeId);
    if (fee) {
      setTotalFee(String(fee.amount));
      setMode(fee.mode);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Convert to student</h2>
      <div className="flex flex-col gap-3">
        <Field label="Course">
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setBatchId("");
            }}
            required
            className="input"
          >
            <option value="" disabled>
              Select course
            </option>
            {coursesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {selectedCourse && selectedCourse.feeStructures.length > 0 && (
          <Field label="Fee structure">
            <select onChange={(e) => applyFeeFromStructure(e.target.value)} className="input" defaultValue="">
              <option value="" disabled>
                Prefill from fee structure
              </option>
              {selectedCourse.feeStructures.map((fee) => (
                <option key={fee.id} value={fee.id}>
                  {fee.label} · {fee.mode} · {formatINR(fee.amount)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as CourseMode)} className="input">
            {modes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Batch (optional)">
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input" disabled={!courseId}>
            <option value="">Not assigned yet</option>
            {batchesForCourse.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.schedule}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total fee (₹)">
          <input type="number" min={0} value={totalFee} onChange={(e) => setTotalFee(e.target.value)} required className="input" />
        </Field>
        <Field label="Where from">
          <input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="City / area" className="input" />
        </Field>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Convert to student
        </button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </form>
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
