import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recordManualPayment } from "@/lib/paymentsApi";
import { fetchStudents } from "@/lib/studentsApi";
import { formatINR } from "@/lib/format";
import { StudentPicker } from "@/components/StudentPicker";
import type { AxiosError } from "axios";

const manualMethods = ["CASH", "BANK_TRANSFER", "OTHER"] as const;

const todayStr = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentPage() {
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });

  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof manualMethods)[number]>("CASH");
  const [paidAt, setPaidAt] = useState(todayStr());
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { studentId: string; amount: number; method: typeof method; paidAt?: string; notes?: string }) =>
      recordManualPayment(input),
    onSuccess: () => {
      setAmount("");
      setNotes("");
      setPaidAt(todayStr());
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const applyBalance = (id: string) => {
    setStudentId(id);
    const student = studentsQuery.data?.find((s) => s.id === id);
    if (student) setAmount(String(student.balanceDue));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      studentId,
      amount: Number(amount),
      method,
      paidAt: paidAt || undefined,
      notes: notes || undefined,
    });
  };

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to record payment");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record a payment</h1>
        <p className="text-sm text-slate-500">For fees collected in cash or by bank transfer, outside of Razorpay.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Student</span>
            <StudentPicker students={studentsQuery.data ?? []} value={studentId} onChange={applyBalance} className="w-full sm:w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-32" />
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Date</span>
            <input
              type="date"
              value={paidAt}
              max={todayStr()}
              onChange={(e) => setPaidAt(e.target.value)}
              required
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Notes (optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending || !studentId}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Record payment
          </button>
        </div>
        {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
        {mutation.isSuccess && (
          <p className="mt-2 text-sm text-slate-600">
            Recorded {formatINR(mutation.data.amount)}
            {mutation.variables && mutation.variables.amount > mutation.data.amount && (
              <span className="text-amber-600">
                {" "}
                (capped down from {formatINR(mutation.variables.amount)} — that's the full balance due)
              </span>
            )}
            .
          </p>
        )}
      </form>
    </div>
  );
}
