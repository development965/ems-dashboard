import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBatch, fetchBatches } from "@/lib/batchesApi";
import { fetchCourses } from "@/lib/coursesApi";
import { fetchBranches } from "@/lib/branchesApi";
import { useAuthStore } from "@/store/authStore";
import { canSeeAllBranches } from "@/lib/roles";
import { TableLoadingRow } from "@/components/Spinner";
import type { CourseMode } from "@/types/course";

const modes: CourseMode[] = ["ONLINE", "OFFLINE", "HYBRID"];

export function BatchesPage() {
  const user = useAuthStore((state) => state.user);
  const seesAllBranches = canSeeAllBranches(user?.role);
  const queryClient = useQueryClient();

  const batchesQuery = useQuery({ queryKey: ["batches"], queryFn: () => fetchBatches() });
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches, enabled: seesAllBranches });

  const [courseId, setCourseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CourseMode>("OFFLINE");
  const [schedule, setSchedule] = useState("");
  const [capacity, setCapacity] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createBatch({
        courseId,
        name,
        mode,
        schedule,
        capacity: capacity ? Number(capacity) : undefined,
        branchId: seesAllBranches ? branchId : undefined,
      }),
    onSuccess: () => {
      setName("");
      setSchedule("");
      setCapacity("");
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500">Batch timings scheduled at {seesAllBranches ? "each branch" : "your branch"}.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required className="input">
            <option value="" disabled>
              Select course
            </option>
            {coursesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {seesAllBranches && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Branch</span>
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
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Batch name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Morning Batch" className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as CourseMode)} className="input">
            {modes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Schedule</span>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            required
            placeholder="Mon-Fri, 6-8 PM"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Capacity</span>
          <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input" />
        </label>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Add batch
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Course</th>
              {seesAllBranches && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batchesQuery.isLoading && <TableLoadingRow colSpan={seesAllBranches ? 6 : 5} />}
            {batchesQuery.data?.map((batch) => (
              <tr key={batch.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{batch.name}</td>
                <td className="px-4 py-3 text-slate-500">{batch.course.name}</td>
                {seesAllBranches && <td className="px-4 py-3 text-slate-500">{batch.branch.name}</td>}
                <td className="px-4 py-3 text-slate-500">{batch.mode}</td>
                <td className="px-4 py-3 text-slate-500">{batch.schedule}</td>
                <td className="px-4 py-3 text-slate-500">{batch.capacity ?? "—"}</td>
              </tr>
            ))}
            {batchesQuery.isSuccess && batchesQuery.data.length === 0 && (
              <tr>
                <td colSpan={seesAllBranches ? 6 : 5} className="px-4 py-6 text-center text-slate-400">
                  No batches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
