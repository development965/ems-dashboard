import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { changeOwnPassword } from "@/lib/usersApi";

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changeOwnPassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mismatch || newPassword.length < 8) return;
    mutation.mutate();
  };

  const errorMessage =
    mutation.isError && ((mutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to change password");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Change password</h1>
        <p className="text-sm text-slate-500">Update the password used to sign in to your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="input"
            />
            {mismatch && <span className="text-xs text-red-600">Passwords don't match.</span>}
          </label>
          <button
            type="submit"
            disabled={mutation.isPending || mismatch || newPassword.length < 8}
            className="mt-2 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Update password
          </button>
        </div>
        {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
        {mutation.isSuccess && <p className="mt-3 text-sm text-green-700">Password updated.</p>}
      </form>
    </div>
  );
}
