import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
  }`;

export function MastersLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Masters</h1>
        <p className="text-sm text-slate-500">Course catalog, fee structures, and batch timings.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        <NavLink to="/masters/courses" className={tabClass}>
          Courses
        </NavLink>
        <NavLink to="/masters/batches" className={tabClass}>
          Batches
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
