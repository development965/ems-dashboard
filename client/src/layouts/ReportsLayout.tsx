import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
  }`;

export function ReportsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Revenue, enrollment, and dues — all in one place.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        <NavLink to="/reports" end className={tabClass}>
          Overview
        </NavLink>
        <NavLink to="/reports/revenue" className={tabClass}>
          Revenue
        </NavLink>
        <NavLink to="/reports/receipts" className={tabClass}>
          Receipts
        </NavLink>
        <NavLink to="/reports/students" className={tabClass}>
          Students
        </NavLink>
        <NavLink to="/reports/outstanding" className={tabClass}>
          Outstanding
        </NavLink>
        <NavLink to="/reports/placement" className={tabClass}>
          Placement
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
