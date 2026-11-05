import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
  }`;

export function PaymentsLayout() {
  const user = useAuthStore((state) => state.user);
  const canDiscount = user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        <NavLink to="/payments" end className={tabClass}>
          Overview
        </NavLink>
        <NavLink to="/payments/links" className={tabClass}>
          Payment Links
        </NavLink>
        <NavLink to="/payments/record" className={tabClass}>
          Record Payment
        </NavLink>
        <NavLink to="/payments/ledger" className={tabClass}>
          Ledger
        </NavLink>
        <NavLink to="/payments/revenue-shares" className={tabClass}>
          Revenue Shares
        </NavLink>
        <NavLink to="/payments/reminders" className={tabClass}>
          Reminders
        </NavLink>
        {canDiscount && (
          <NavLink to="/payments/discounts" className={tabClass}>
            Discounts
          </NavLink>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
