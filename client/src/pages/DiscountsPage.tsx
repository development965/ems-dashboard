import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDiscount, fetchDiscounts } from "@/lib/discountsApi";
import { fetchStudents } from "@/lib/studentsApi";
import { formatINR } from "@/lib/format";
import { StudentPicker } from "@/components/StudentPicker";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableLoadingRow } from "@/components/Spinner";
import type { AxiosError } from "axios";

export function DiscountsPage() {
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const discountsQuery = useQuery({ queryKey: ["discounts"], queryFn: () => fetchDiscounts() });

  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { studentId: string; amount: number; reason?: string }) => createDiscount(input),
    onSuccess: () => {
      setAmount("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to grant discount");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ studentId, amount: Number(amount), reason: reason || undefined });
  };

  const discounts = discountsQuery.data ?? [];
  const totalDiscounted = discounts.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Discounts</h1>
        <p className="text-sm text-slate-500">Grant fee reductions with an auditable reason — never a silent fee edit.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Grant a discount</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Student</span>
            <StudentPicker students={studentsQuery.data ?? []} value={studentId} onChange={setStudentId} className="w-full sm:w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input w-32" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending || !studentId}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            Grant discount
          </button>
        </form>
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
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Discount ledger</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              Total discounted: <span className="font-medium text-amber-600">{formatINR(totalDiscounted)}</span>
            </p>
            <ExportCsvButton
              filename="discounts"
              headers={["Student", "Amount", "Reason", "Approved by", "Date"]}
              rows={discounts.map((d) => [
                d.student.name,
                d.amount,
                d.reason ?? "",
                d.approvedBy.name,
                new Date(d.createdAt).toLocaleDateString(),
              ])}
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Approved by</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discountsQuery.isLoading && <TableLoadingRow colSpan={5} />}
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{d.student.name}</td>
                  <td className="px-4 py-3 text-amber-600">− {formatINR(d.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{d.reason || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{d.approvedBy.name}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {discountsQuery.isSuccess && discounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No discounts granted yet.
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
