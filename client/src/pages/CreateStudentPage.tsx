import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createStudent, fetchStudents } from "@/lib/studentsApi";
import { fetchCourses } from "@/lib/coursesApi";
import { fetchBatches } from "@/lib/batchesApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { formatINR } from "@/lib/format";
import type { CourseMode } from "@/types/course";
import type { AxiosError } from "axios";

const modes: CourseMode[] = ["ONLINE", "OFFLINE", "HYBRID"];

export function CreateStudentPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const canDiscount = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const batchesQuery = useQuery({ queryKey: ["batches"], queryFn: () => fetchBatches() });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: seesAllBranches });

  // Arriving from "Enroll in another course" on an existing student's profile pre-fills their
  // details — same person, new course, so there's no reason to retype name/phone/location.
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [mode, setMode] = useState<CourseMode>("OFFLINE");
  const [totalFee, setTotalFee] = useState("");
  const [branchId, setBranchId] = useState(searchParams.get("branchId") ?? "");

  // Phone numbers aren't unique — the same person can legitimately have more than one
  // enrollment (e.g. SAP MM and SAP FICO). Surface any existing matches so staff can tell
  // "adding a second course for someone we already know" apart from an accidental duplicate.
  const existingQuery = useQuery({
    queryKey: ["students", "phone-check", phone],
    queryFn: () => fetchStudents(phone),
    enabled: phone.trim().length >= 6,
  });
  const existingMatches = existingQuery.data?.filter((s) => s.phone === phone) ?? [];

  const selectedCourse = coursesQuery.data?.find((c) => c.id === courseId);
  const batchesForCourse = useMemo(
    () => batchesQuery.data?.filter((b) => b.courseId === courseId && (!seesAllBranches || b.branchId === branchId)) ?? [],
    [batchesQuery.data, courseId, branchId, seesAllBranches],
  );

  const mutation = useMutation({
    mutationFn: () =>
      createStudent({
        name,
        phone,
        email: email || undefined,
        location,
        courseId,
        batchId: batchId || undefined,
        mode,
        totalFee: Number(totalFee),
        branchId: seesAllBranches ? branchId : undefined,
      }),
    onSuccess: (student) => {
      // Same tab now shows the freshly enrolled student's profile — natural next step after enrolling.
      navigate(`/students/${student.id}`, { replace: true });
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to enroll student");

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Enroll a student</h1>
        <p className="text-sm text-slate-500">Capture a new enrollment and its fee.</p>
      </div>

      {existingMatches.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">
            This phone number already has {existingMatches.length} enrollment{existingMatches.length === 1 ? "" : "s"} — enrolling in a
            second course is fine (e.g. SAP MM and SAP FICO), just confirm this isn't a duplicate first.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {existingMatches.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}`} className="text-amber-700 hover:underline">
                  {s.name} — {s.course.name} @ {s.branch.name} ({s.status})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="input" />
        </Field>
        <Field label="Email (optional)">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Where from">
          <input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="City / area" className="input" />
        </Field>

        {seesAllBranches && (
          <Field label="Branch">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required className="input">
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

        <Field label="Fee structure">
          <select onChange={(e) => applyFeeFromStructure(e.target.value)} className="input" defaultValue="">
            <option value="" disabled>
              Prefill from fee structure
            </option>
            {selectedCourse?.feeStructures.map((fee) => (
              <option key={fee.id} value={fee.id}>
                {fee.label} · {fee.mode} · {formatINR(fee.amount)}
              </option>
            ))}
          </select>
        </Field>

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
          <input
            type="number"
            min={0}
            value={totalFee}
            onChange={(e) => setTotalFee(e.target.value)}
            required
            readOnly={!canDiscount}
            title={canDiscount ? undefined : "Only accountants and super admins can set a custom/discounted fee"}
            className={`input ${canDiscount ? "" : "cursor-not-allowed bg-slate-50 text-slate-500"}`}
          />
          {!canDiscount && (
            <span className="text-xs text-slate-400">Set by the course's fee structure — ask an accountant for a discount.</span>
          )}
        </Field>

        <div className="col-span-full flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Enroll student
          </button>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </div>
      </form>
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
