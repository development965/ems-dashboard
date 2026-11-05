import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { fetchBranches } from "@/lib/branchesApi";
import { createUser, deleteUser, fetchUsers, resetUserPassword, updateUser } from "@/lib/usersApi";
import { useAuthStore } from "@/store/authStore";
import { TableLoadingRow } from "@/components/Spinner";
import type { Role } from "@/types/auth";
import type { ManagedUser } from "@/types/user";

const roles: Role[] = ["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

function errorMessageOf(error: unknown, fallback: string): string {
  return (error as AxiosError<{ error: string }>).response?.data?.error ?? fallback;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ACCOUNTANT");
  const [branchId, setBranchId] = useState("");

  const mutation = useMutation({
    mutationFn: () => createUser({ name, email, password, role, branchId: branchId || undefined }),
    onSuccess: () => {
      setName("");
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">Manage super admins, branch admins, and accountants.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        {role === "BRANCH_ADMIN" && (
          <Field label="Branch">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required className="input">
              <option value="" disabled>
                Select branch
              </option>
              {branchesQuery.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {role === "ACCOUNTANT" && (
          <Field label="Branch (optional)">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">Company-wide — no specific branch</option>
              {branchesQuery.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="col-span-full">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Add user
          </button>
          {mutation.isError && <span className="ml-3 text-sm text-red-600">{errorMessageOf(mutation.error, "Failed to add user")}</span>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQuery.isLoading && <TableLoadingRow colSpan={5} />}
            {usersQuery.data?.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user }: { user: ManagedUser }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isSelf = currentUser?.id === user.id;
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const [mode, setMode] = useState<"view" | "edit" | "reset-password">("view");
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [branchId, setBranchId] = useState(user.branchId ?? "");
  const [newPassword, setNewPassword] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const editMutation = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        name,
        role,
        branchId: role === "SUPER_ADMIN" ? null : branchId || null,
      }),
    onSuccess: () => {
      setMode("view");
      invalidate();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => updateUser(user.id, { isActive: !user.isActive }),
    onSuccess: invalidate,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword(user.id, newPassword),
    onSuccess: () => {
      setNewPassword("");
      setMode("view");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: invalidate,
  });

  const handleDelete = () => {
    if (window.confirm(`Delete ${user.name}'s account? This can't be undone.`)) {
      deleteMutation.mutate();
    }
  };

  if (mode === "edit") {
    return (
      <tr className="bg-slate-50">
        <td className="px-4 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </td>
        <td className="px-4 py-3 text-slate-500">{user.email}</td>
        <td className="px-4 py-3">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3" colSpan={2}>
          <div className="flex flex-wrap items-center gap-2">
            {role !== "SUPER_ADMIN" && (
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
                <option value="">{role === "ACCOUNTANT" ? "Company-wide" : "Select branch"}</option>
                {branchesQuery.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setMode("view")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            {editMutation.isError && <span className="text-xs text-red-600">{errorMessageOf(editMutation.error, "Failed to save")}</span>}
          </div>
        </td>
      </tr>
    );
  }

  if (mode === "reset-password") {
    return (
      <tr className="bg-slate-50">
        <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
        <td className="px-4 py-3 text-slate-500">{user.email}</td>
        <td className="px-4 py-3 text-slate-500" colSpan={3}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="input"
            />
            <button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending || newPassword.length < 8}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Set password
            </button>
            <button
              onClick={() => setMode("view")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            {resetPasswordMutation.isError && (
              <span className="text-xs text-red-600">{errorMessageOf(resetPasswordMutation.error, "Failed to reset password")}</span>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
      <td className="px-4 py-3 text-slate-500">{user.email}</td>
      <td className="px-4 py-3 text-slate-500">{user.role.replace("_", " ")}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            user.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setMode("edit")} className="text-xs font-medium text-brand-600 hover:underline">
            Edit
          </button>
          <button
            onClick={() => toggleActiveMutation.mutate()}
            disabled={toggleActiveMutation.isPending || (isSelf && user.isActive)}
            title={isSelf && user.isActive ? "You can't deactivate your own account" : undefined}
            className="text-xs font-medium text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={() => setMode("reset-password")} className="text-xs font-medium text-slate-600 hover:underline">
            Reset password
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending || isSelf}
            title={isSelf ? "You can't delete your own account" : undefined}
            className="text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
        {toggleActiveMutation.isError && (
          <p className="mt-1 text-xs text-red-600">{errorMessageOf(toggleActiveMutation.error, "Failed to update status")}</p>
        )}
        {deleteMutation.isError && <p className="mt-1 text-xs text-red-600">{errorMessageOf(deleteMutation.error, "Failed to delete")}</p>}
      </td>
    </tr>
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
