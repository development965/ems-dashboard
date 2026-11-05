import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { logoutRequest } from "@/lib/authApi";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  // Below `lg` (phones — iPhone 16 at 393px, Galaxy Fold's cover screen at ~280px, tablets
  // in portrait) the sidebar can't sit beside the content at a fixed 240px without crushing
  // it, so it becomes a slide-in drawer instead; at `lg` and up it's the original static rail.
  const [navOpen, setNavOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // Ignore network errors on logout — clearing local session is what matters.
      }
    }
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex shrink-0 items-center justify-between px-2">
          <div>
            <img src="/techmaax-logo.png" alt="Techmaax" className="h-9 w-auto" />
            <p className="mt-1 text-xs text-slate-500">{user.role.replace("_", " ")}</p>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        {/* Any nav link click (bubbling up here) closes the drawer on mobile — a no-op at
            `lg` since the drawer classes don't apply there anyway. */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" onClick={() => setNavOpen(false)}>
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          {(user.role === "SUPER_ADMIN" || user.role === "ACCOUNTANT") && (
            <NavLink to="/masters" className={navLinkClass}>
              Masters
            </NavLink>
          )}
          {/* Accountants are company-wide on the finance side (Masters/Payments/Reports)
              but don't manage enrollment records — that's a branch's own job. */}
          {user.role !== "ACCOUNTANT" && (
            <>
              <NavLink to="/leads" className={navLinkClass}>
                Leads
              </NavLink>
              <NavLink to="/students" className={navLinkClass}>
                Students
              </NavLink>
            </>
          )}
          <NavLink to="/payments" className={navLinkClass}>
            Payments
          </NavLink>
          <NavLink to="/petty-cash" className={navLinkClass}>
            Petty Cash
          </NavLink>
          <NavLink to="/outstanding" className={navLinkClass}>
            Outstanding
          </NavLink>
          <NavLink to="/transfers" className={navLinkClass}>
            Transfers
          </NavLink>
          <NavLink to="/reports" className={navLinkClass}>
            Reports
          </NavLink>
          {user.role === "SUPER_ADMIN" && (
            <>
              <div className="my-2 border-t border-slate-100" />
              <NavLink to="/branches" className={navLinkClass}>
                Branches
              </NavLink>
              <NavLink to="/users" className={navLinkClass}>
                Users
              </NavLink>
              <NavLink to="/targets" className={navLinkClass}>
                Targets
              </NavLink>
              <NavLink to="/audit-log" className={navLinkClass}>
                Audit Log
              </NavLink>
              <NavLink to="/backup" className={navLinkClass}>
                Backups
              </NavLink>
            </>
          )}
        </nav>
        <div className="mt-auto shrink-0 pt-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <img src="/techmaax-logo.png" alt="Techmaax" className="h-6 w-auto shrink-0 lg:hidden" />
            <p className="hidden truncate text-sm text-slate-500 sm:block">Welcome back, {user.name}</p>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <p className="hidden truncate text-sm font-medium text-slate-700 md:block">{user.email}</p>
            <NavLink to="/change-password" className="whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
              Change password
            </NavLink>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
