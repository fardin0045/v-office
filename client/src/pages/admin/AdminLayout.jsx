import { lazy, Suspense } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ClipboardList, Grid3x3, LayoutDashboard, Radio, Shield, Users } from 'lucide-react';
import { PageLoader } from '../../components/ui';
import { cn } from '../../lib/utils';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const EmployeeManager = lazy(() => import('./EmployeeManager'));
const EmployeeMonthActivity = lazy(() => import('./EmployeeMonthActivity'));
const DeskManager = lazy(() => import('./DeskManager'));
const LiveOfficeMonitor = lazy(() => import('./LiveOfficeMonitor'));
const WorkSessionLog = lazy(() => import('./WorkSessionLog'));

const MENU = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/workstations', label: 'Workstations', icon: Grid3x3 },
  { to: '/admin/live', label: 'Live office', icon: Radio },
  { to: '/admin/sessions', label: 'Attendance log', icon: ClipboardList },
];

export function AdminLayout() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-transparent">
        <div className="hidden items-center gap-2.5 px-6 pb-4 pt-8 lg:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-night text-brand ring-1 ring-slate-200">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Admin</p>
            <p className="text-xs text-slate-500">Workspace management</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 py-2 lg:flex-col lg:px-4 lg:py-0" aria-label="Admin">
          {MENU.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="employees" element={<EmployeeManager />} />
            <Route path="employees/:id/activity" element={<EmployeeMonthActivity />} />
            <Route path="workstations" element={<DeskManager />} />
            <Route path="live" element={<LiveOfficeMonitor />} />
            <Route path="sessions" element={<WorkSessionLog />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default AdminLayout;
