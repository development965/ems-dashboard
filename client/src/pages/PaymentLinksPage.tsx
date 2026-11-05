import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelPaymentLink, createPaymentLink, fetchPaymentLinks } from "@/lib/paymentsApi";
import { fetchStudents } from "@/lib/studentsApi";
import { formatINR } from "@/lib/format";
import { StudentPicker } from "@/components/StudentPicker";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableLoadingRow } from "@/components/Spinner";
import type { AxiosError } from "axios";

export function PaymentLinksPage() {
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const linksQuery = useQuery({ queryKey: ["payment-links"], queryFn: () => fetchPaymentLinks() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    queryClient.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment links</h1>
        <p className="text-sm text-slate-500">Generate a Razorpay payment link with a preset amount and share it with a student.</p>
      </div>

      <PaymentLinkForm students={studentsQuery.data ?? []} onCreated={invalidate} />
      <PaymentLinksTable links={linksQuery.data ?? []} isLoading={linksQuery.isLoading} onChange={invalidate} />
    </div>
  );
}

function PaymentLinkForm({
  students,
  onCreated,
}: {
  students: { id: string; name: string; phone: string; balanceDue: number }[];
  onCreated: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { studentId: string; amount: number; description?: string }) => createPaymentLink(input),
    onSuccess: () => {
      setAmount("");
      setDescription("");
      onCreated();
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to create link");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ studentId, amount: Number(amount), description: description || undefined });
  };

  const applyBalance = (id: string) => {
    setStudentId(id);
    const student = students.find((s) => s.id === id);
    if (student) setAmount(String(student.balanceDue));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Create a payment link</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Student</span>
          <StudentPicker students={students} value={studentId} onChange={applyBalance} className="w-full sm:w-64" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-32" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Description (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending || !studentId}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Generate link
        </button>
      </form>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
      {mutation.isSuccess && (
        <p className="mt-2 text-sm text-slate-600">
          Link ready for {formatINR(mutation.data.amount)}
          {mutation.variables && mutation.variables.amount > mutation.data.amount && (
            <span className="text-amber-600">
              {" "}
              (capped down from {formatINR(mutation.variables.amount)} — that's the full balance due)
            </span>
          )}
          :{" "}
          <a href={mutation.data.shortUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
            {mutation.data.shortUrl}
          </a>
        </p>
      )}
    </section>
  );
}

function PaymentLinksTable({
  links,
  isLoading,
  onChange,
}: {
  links: {
    id: string;
    student: { name: string; phone: string };
    amount: number;
    status: string;
    shortUrl: string;
    createdAt: string;
  }[];
  isLoading: boolean;
  onChange: () => void;
}) {
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPaymentLink(id),
    onSuccess: onChange,
  });

  const cancelErrorMessage =
    cancelMutation.isError &&
    ((cancelMutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to cancel link");

  const statusStyle: Record<string, string> = {
    CREATED: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
    EXPIRED: "bg-slate-100 text-slate-500",
    CANCELLED: "bg-slate-100 text-slate-500",
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Payment links</h2>
        <ExportCsvButton
          filename="payment-links"
          headers={["Student", "Phone", "Amount", "Status", "Link", "Created"]}
          rows={links.map((l) => [
            l.student.name,
            l.student.phone,
            l.amount,
            l.status,
            l.shortUrl,
            new Date(l.createdAt).toLocaleDateString(),
          ])}
        />
      </div>
      {cancelErrorMessage && <p className="mb-3 text-sm text-red-600">{cancelErrorMessage}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Link</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <TableLoadingRow colSpan={5} />}
            {links.map((link) => (
              <tr key={link.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{link.student.name}</td>
                <td className="px-4 py-3 text-slate-500">{formatINR(link.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[link.status] ?? ""}`}>
                    {link.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a href={link.shortUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                    Open
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  {link.status === "CREATED" && (
                    <button
                      onClick={() => cancelMutation.mutate(link.id)}
                      disabled={cancelMutation.isPending}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && links.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No payment links created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
