import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchStudent, fetchStudents, updateStudent, uploadStudentDocuments } from "@/lib/studentsApi";
import { deletePayment, fetchPayments, recordManualPayment } from "@/lib/paymentsApi";
import { createDiscount, fetchDiscounts } from "@/lib/discountsApi";
import { formatINR } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";
import { PageLoader } from "@/components/Spinner";
import type { Discount } from "@/types/discount";
import type { CourseMode } from "@/types/course";
import type { CertificationStatus, PlacementStatus, Student, StudentStatus } from "@/types/student";
import type { AxiosError } from "axios";

const modes: CourseMode[] = ["ONLINE", "OFFLINE", "HYBRID"];
const statuses: StudentStatus[] = ["ENROLLED", "COMPLETED", "DROPPED"];
const manualMethods = ["CASH", "BANK_TRANSFER", "OTHER"] as const;
const certificationStatuses: CertificationStatus[] = ["NOT_ISSUED", "ISSUED"];
const placementStatuses: PlacementStatus[] = ["NOT_PLACED", "IN_PROGRESS", "PLACED"];

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const canDiscount = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  // Accountants are company-wide on the finance side but don't manage enrollment records —
  // that stays with whichever branch enrolled the student.
  const canEditStudent = user?.role === "SUPER_ADMIN" || user?.role === "BRANCH_ADMIN";
  const queryClient = useQueryClient();

  const studentQuery = useQuery({ queryKey: ["student", id], queryFn: () => fetchStudent(id!), enabled: Boolean(id) });
  const paymentsQuery = useQuery({
    queryKey: ["payments", id],
    queryFn: () => fetchPayments(id),
    enabled: Boolean(id),
  });
  const discountsQuery = useQuery({
    queryKey: ["discounts", id],
    queryFn: () => fetchDiscounts(id),
    enabled: Boolean(id) && canDiscount,
  });
  // The same person can have more than one enrollment (e.g. SAP MM and SAP FICO are each
  // their own Student row, with their own fee/payments) — matched by phone since that's the
  // one field guaranteed to carry over between a person's separate course enrollments.
  const phone = studentQuery.data?.phone;
  const otherEnrollmentsQuery = useQuery({
    queryKey: ["students", "phone-check", phone],
    queryFn: () => fetchStudents(phone),
    enabled: Boolean(phone),
  });
  const otherEnrollments = otherEnrollmentsQuery.data?.filter((s) => s.id !== id && s.phone === phone) ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["student", id] });
    queryClient.invalidateQueries({ queryKey: ["payments", id] });
    queryClient.invalidateQueries({ queryKey: ["discounts", id] });
    queryClient.invalidateQueries({ queryKey: ["students"] });
  };

  if (studentQuery.isLoading) return <PageLoader />;
  if (studentQuery.isError || !studentQuery.data) return <p className="text-sm text-red-600">Student not found.</p>;

  const student = studentQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500">
            {student.course.name} · {student.branch.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canEditStudent && (
            <Link
              to={`/students/new?name=${encodeURIComponent(student.name)}&phone=${encodeURIComponent(student.phone)}&email=${encodeURIComponent(student.email ?? "")}&location=${encodeURIComponent(student.location)}&branchId=${student.branchId}`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              + Enroll in another course
            </Link>
          )}
          <Link to="/students" className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to students
          </Link>
        </div>
      </div>

      {otherEnrollments.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-700">Also enrolled in:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {otherEnrollments.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}`} className="text-brand-600 hover:underline">
                  {s.course.name} @ {s.branch.name} ({s.status})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {canEditStudent ? (
            <>
              <ProfileForm student={student} onSaved={invalidate} />
              <PlacementCertificationForm student={student} onSaved={invalidate} />
              <DocumentsCard student={student} onUploaded={invalidate} />
            </>
          ) : (
            <>
              <ReadOnlyProfileCard student={student} />
              <PlacementCertificationReadOnly student={student} />
            </>
          )}
          {canDiscount && <DiscountHistoryCard discounts={discountsQuery.data ?? []} />}
        </div>

        <div className="flex flex-col gap-6">
          <FeeSummaryCard student={student} />
          {canDiscount && student.balanceDue > 0 && (
            <DiscountForm studentId={student.id} balanceDue={student.balanceDue} onGranted={invalidate} />
          )}
          <RecordPaymentForm studentId={student.id} balanceDue={student.balanceDue} onRecorded={invalidate} />
          <PaymentHistoryCard payments={paymentsQuery.data ?? []} canDelete={user?.role === "SUPER_ADMIN"} onDeleted={invalidate} />
        </div>
      </div>
    </div>
  );
}

function ProfileForm({ student, onSaved }: { student: Student; onSaved: () => void }) {
  const user = useAuthStore((state) => state.user);
  const canDiscount = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone);
  const [email, setEmail] = useState(student.email ?? "");
  const [location, setLocation] = useState(student.location);
  const [mode, setMode] = useState<CourseMode>(student.mode);
  const [totalFee, setTotalFee] = useState(String(student.totalFee));
  const [status, setStatus] = useState<StudentStatus>(student.status);
  const [notes, setNotes] = useState(student.notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateStudent(student.id, {
        name,
        phone,
        email: email || undefined,
        location,
        mode,
        totalFee: Number(totalFee),
        status,
        notes: notes || undefined,
      }),
    onSuccess: onSaved,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Profile</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Where from">
          <input value={location} onChange={(e) => setLocation(e.target.value)} required className="input" />
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
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)} className="input">
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
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
        </Field>
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-4 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        Save changes
      </button>
      {mutation.isSuccess && <span className="ml-3 text-sm text-green-700">Saved.</span>}
    </form>
  );
}

/** Accountants can view a student's record (e.g. from a Payments/Reports link) but don't manage
 * enrollment data — that stays with the branch, so this is read-only instead of the edit form. */
function ReadOnlyProfileCard({ student }: { student: Student }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Profile</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Field label="Name">
          <p className="text-slate-800">{student.name}</p>
        </Field>
        <Field label="Phone">
          <p className="text-slate-800">{student.phone}</p>
        </Field>
        <Field label="Email">
          <p className="text-slate-800">{student.email || "—"}</p>
        </Field>
        <Field label="Where from">
          <p className="text-slate-800">{student.location}</p>
        </Field>
        <Field label="Mode">
          <p className="text-slate-800">{student.mode}</p>
        </Field>
        <Field label="Status">
          <p className="text-slate-800">{student.status}</p>
        </Field>
      </dl>
    </div>
  );
}

function PlacementCertificationForm({ student, onSaved }: { student: Student; onSaved: () => void }) {
  const [certificationStatus, setCertificationStatus] = useState<CertificationStatus>(student.certificationStatus);
  const [certificateNo, setCertificateNo] = useState(student.certificateNo ?? "");
  const [placementStatus, setPlacementStatus] = useState<PlacementStatus>(student.placementStatus);
  const [placementCompany, setPlacementCompany] = useState(student.placementCompany ?? "");
  const [placementRole, setPlacementRole] = useState(student.placementRole ?? "");
  const [placementPackageLPA, setPlacementPackageLPA] = useState(
    student.placementPackageLPA !== null ? String(student.placementPackageLPA) : "",
  );

  const mutation = useMutation({
    mutationFn: () =>
      updateStudent(student.id, {
        certificationStatus,
        certificateNo: certificateNo || undefined,
        placementStatus,
        placementCompany: placementCompany || undefined,
        placementRole: placementRole || undefined,
        placementPackageLPA: placementPackageLPA ? Number(placementPackageLPA) : undefined,
      }),
    onSuccess: onSaved,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Certification &amp; placement</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Certification">
          <select value={certificationStatus} onChange={(e) => setCertificationStatus(e.target.value as CertificationStatus)} className="input">
            {certificationStatuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Certificate no.">
          <input value={certificateNo} onChange={(e) => setCertificateNo(e.target.value)} className="input" />
        </Field>
        <Field label="Placement">
          <select value={placementStatus} onChange={(e) => setPlacementStatus(e.target.value as PlacementStatus)} className="input">
            {placementStatuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Package (LPA)">
          <input
            type="number"
            min={0}
            step="0.1"
            value={placementPackageLPA}
            onChange={(e) => setPlacementPackageLPA(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Placed at company">
          <input value={placementCompany} onChange={(e) => setPlacementCompany(e.target.value)} className="input" />
        </Field>
        <Field label="Role">
          <input value={placementRole} onChange={(e) => setPlacementRole(e.target.value)} className="input" />
        </Field>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-4 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        Save
      </button>
      {mutation.isSuccess && <span className="ml-3 text-sm text-green-700">Saved.</span>}
    </form>
  );
}

function PlacementCertificationReadOnly({ student }: { student: Student }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Certification &amp; placement</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Field label="Certification">
          <p className="text-slate-800">{student.certificationStatus.replace("_", " ")}</p>
        </Field>
        <Field label="Placement">
          <p className="text-slate-800">{student.placementStatus.replace("_", " ")}</p>
        </Field>
        {student.placementCompany && (
          <Field label="Company / role">
            <p className="text-slate-800">
              {student.placementCompany}
              {student.placementRole ? ` — ${student.placementRole}` : ""}
            </p>
          </Field>
        )}
      </dl>
    </div>
  );
}

function DocumentsCard({
  student,
  onUploaded,
}: {
  student: { id: string; photoUrl: string | null; idProofUrl: string | null };
  onUploaded: () => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [idProof, setIdProof] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      uploadStudentDocuments(student.id, { photo: photo ?? undefined, idProof: idProof ?? undefined }),
    onSuccess: () => {
      setPhoto(null);
      setIdProof(null);
      onUploaded();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Upload failed");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Photo &amp; ID proof</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Photo</p>
          {student.photoUrl ? (
            <img src={student.photoUrl} alt="Student" className="mb-2 h-32 w-32 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="mb-2 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              No photo
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">ID proof</p>
          {student.idProofUrl ? (
            <a href={student.idProofUrl} target="_blank" rel="noreferrer" className="mb-2 block text-sm text-brand-600 hover:underline">
              View uploaded ID proof
            </a>
          ) : (
            <div className="mb-2 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              No ID proof
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
            onChange={(e) => setIdProof(e.target.files?.[0] ?? null)}
            className="text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600"
          />
        </div>
      </div>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (!photo && !idProof)}
        className="mt-4 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        Upload
      </button>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}

function FeeSummaryCard({
  student,
}: {
  student: { totalFee: number; totalDiscount: number; netFee: number; amountPaid: number; balanceDue: number };
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Fee summary</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Total fee</dt>
          <dd className="font-medium text-slate-800">{formatINR(student.totalFee)}</dd>
        </div>
        {student.totalDiscount > 0 && (
          <>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-medium text-amber-600">− {formatINR(student.totalDiscount)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt className="text-slate-500">Net fee</dt>
              <dd className="font-medium text-slate-800">{formatINR(student.netFee)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Paid</dt>
          <dd className="font-medium text-green-700">{formatINR(student.amountPaid)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <dt className="text-slate-500">Balance due</dt>
          <dd className="font-semibold text-red-600">{formatINR(student.balanceDue)}</dd>
        </div>
      </dl>
      <Link to="/payments" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
        Send a payment link →
      </Link>
    </div>
  );
}

function RecordPaymentForm({
  studentId,
  balanceDue,
  onRecorded,
}: {
  studentId: string;
  balanceDue: number;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof manualMethods)[number]>("CASH");

  const mutation = useMutation({
    mutationFn: (input: { studentId: string; amount: number; method: typeof method }) => recordManualPayment(input),
    onSuccess: () => {
      setAmount("");
      onRecorded();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to record payment");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ studentId, amount: Number(amount), method });
  };

  if (balanceDue <= 0) return null;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Record a payment</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-28" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="input">
            {manualMethods.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Record
        </button>
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}

function DiscountForm({
  studentId,
  balanceDue,
  onGranted,
}: {
  studentId: string;
  balanceDue: number;
  onGranted: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { studentId: string; amount: number; reason?: string }) => createDiscount(input),
    onSuccess: () => {
      setAmount("");
      setReason("");
      onGranted();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to grant discount");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ studentId, amount: Number(amount), reason: reason || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Grant a discount</h2>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Amount (₹, up to {formatINR(balanceDue)})</span>
          <input
            type="number"
            min={1}
            max={balanceDue}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          Grant discount
        </button>
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
      {mutation.isSuccess && (
        <p className="mt-2 text-sm text-slate-600">
          Granted {formatINR(mutation.data.amount)}
          {mutation.variables && mutation.variables.amount > mutation.data.amount && (
            <span className="text-amber-600"> (capped down from {formatINR(mutation.variables.amount)} — that's the full balance due)</span>
          )}
          .
        </p>
      )}
    </form>
  );
}

function DiscountHistoryCard({ discounts }: { discounts: Discount[] }) {
  if (discounts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Discount history</h2>
      <div className="flex flex-col gap-2">
        {discounts.map((d) => (
          <div key={d.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0">
            <div>
              <p className="text-slate-700">{d.reason || "No reason given"}</p>
              <p className="text-xs text-slate-400">
                {d.approvedBy.name} · {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className="shrink-0 font-medium text-amber-600">− {formatINR(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentHistoryCard({
  payments,
  canDelete,
  onDeleted,
}: {
  payments: { id: string; amount: number; method: string; paidAt: string }[];
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: onDeleted,
    onSettled: () => setDeletingId(null),
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to delete payment");

  const handleDelete = (p: { id: string; amount: number; method: string; paidAt: string }) => {
    const confirmed = window.confirm(
      `Permanently delete this ${formatINR(p.amount)} (${p.method.replace("_", " ")}, ${new Date(p.paidAt).toLocaleDateString()}) payment? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(p.id);
    mutation.mutate(p.id);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Payment history</h2>
      <div className="flex flex-col gap-2">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0">
            <span className="text-slate-500">
              {p.method.replace("_", " ")} · {new Date(p.paidAt).toLocaleDateString()}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-green-700">{formatINR(p.amount)}</span>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  disabled={mutation.isPending && deletingId === p.id}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  {mutation.isPending && deletingId === p.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
        {payments.length === 0 && <p className="text-sm text-slate-400">No payments recorded yet.</p>}
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
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
