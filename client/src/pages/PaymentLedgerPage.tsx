import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchPayments } from "@/lib/paymentsApi";
import { useAuthStore } from "@/store/authStore";
import { formatINR } from "@/lib/format";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableLoadingRow } from "@/components/Spinner";

export function PaymentLedgerPage() {
  const user = useAuthStore((state) => state.user);
  const canShare = user?.role === "SUPER_ADMIN" || user?.role === "BRANCH_ADMIN";
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => fetchPayments() });
  const payments = paymentsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment ledger</h1>
          <p className="text-sm text-slate-500">Every rupee collected, across every channel.</p>
        </div>
        <ExportCsvButton
          filename="payment-ledger"
          headers={["Student", "Amount", "Method", "Recorded by", "Date"]}
          rows={payments.map((p) => [
            p.student.name,
            p.amount,
            p.method,
            p.recordedBy.name,
            new Date(p.paidAt).toLocaleDateString(),
          ])}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Recorded by</th>
              <th className="px-4 py-3">Date</th>
              {canShare && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paymentsQuery.isLoading && <TableLoadingRow colSpan={canShare ? 6 : 5} />}
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{p.student.name}</td>
                <td className="px-4 py-3 text-green-700">{formatINR(p.amount)}</td>
                <td className="px-4 py-3 text-slate-500">{p.method.replace("_", " ")}</td>
                <td className="px-4 py-3 text-slate-500">{p.recordedBy.name}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</td>
                {canShare && (
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/payments/revenue-shares?paymentId=${p.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Share
                    </Link>
                  </td>
                )}
              </tr>
            ))}
            {paymentsQuery.isSuccess && payments.length === 0 && (
              <tr>
                <td colSpan={canShare ? 6 : 5} className="px-4 py-6 text-center text-slate-400">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
