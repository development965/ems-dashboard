import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBranch, fetchBranches, updateBranch } from "@/lib/branchesApi";
import { TableLoadingRow } from "@/components/Spinner";
import type { Zone } from "@/types/branch";

const ZONE_LABELS: Record<Zone, string> = { ZONE_1: "Zone 1", ZONE_2: "Zone 2", ZONE_3: "Zone 3" };

export function BranchesPage() {
  const queryClient = useQueryClient();
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const mutation = useMutation({
    mutationFn: () => createBranch({ name, code }),
    onSuccess: () => {
      setName("");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const zoneMutation = useMutation({
    mutationFn: ({ id, zone }: { id: string; zone: Zone | null }) => updateBranch(id, { zone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
        <p className="text-sm text-slate-500">
          All branches across the company. Assign each one to a zone to group them on the dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Branch name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Add branch
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branchesQuery.isLoading && <TableLoadingRow colSpan={4} />}
            {branchesQuery.data?.map((branch) => (
              <tr key={branch.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{branch.name}</td>
                <td className="px-4 py-3 text-slate-500">{branch.code}</td>
                <td className="px-4 py-3">
                  <select
                    value={branch.zone ?? ""}
                    disabled={zoneMutation.isPending && zoneMutation.variables?.id === branch.id}
                    onChange={(e) => zoneMutation.mutate({ id: branch.id, zone: (e.target.value || null) as Zone | null })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {(Object.keys(ZONE_LABELS) as Zone[]).map((z) => (
                      <option key={z} value={z}>
                        {ZONE_LABELS[z]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      branch.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {branch.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {branchesQuery.isSuccess && branchesQuery.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No branches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
