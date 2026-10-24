import { Building2, Laptop } from 'lucide-react';
import { useElapsedSeconds } from '../../hooks';
import { cn, formatDateKey, formatDuration, formatTime } from '../../lib/utils';
import { Avatar, Pill, Skeleton, StatusBadge } from '../ui';

function Duration({ session }) {
  // Running sessions tick live; completed ones show their stored duration.
  const live = useElapsedSeconds(session.status === 'working' ? session.checkIn : null);
  return <>{formatDuration(session.status === 'working' ? live : session.duration)}</>;
}

// Desk (if any) plus how the person worked: "DESK-01 · Office", "DESK-01 · Remote" or "Remote".
function ModeBadge({ session }) {
  const isRemote = session.mode === 'remote';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {session.deskId && (
        <Pill tone="brand" icon={Building2} className="font-mono">
          {session.deskId}
        </Pill>
      )}
      <Pill tone={isRemote ? 'neutral' : 'success'} icon={isRemote ? Laptop : undefined}>
        {isRemote ? 'Remote' : 'Office'}
      </Pill>
    </span>
  );
}

const AUTO_REASONS = {
  'auto-offline': 'Checked out automatically after the person closed V-Office',
  'auto-max-duration': 'Checked out automatically after reaching the maximum session length',
};

// Marks sessions that were closed by the system rather than by the employee.
function AutoTag({ session }) {
  const reason = AUTO_REASONS[session.endReason];
  if (!reason) return null;
  return (
    <span title={reason}>
      <Pill tone="warning">Auto</Pill>
    </span>
  );
}

function Employee({ employee }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar person={employee} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{employee?.name || 'Former employee'}</p>
        <p className="truncate font-mono text-xs text-slate-500">{employee?.employeeId || '—'}</p>
      </div>
    </div>
  );
}

export function SessionTable({ sessions, loading, showEmployee = false, skeletonRows = 5, empty }) {
  if (loading) {
    return (
      <div className="space-y-3 p-5" aria-busy="true">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!sessions.length) return empty || null;

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              {showEmployee && <th className="px-5 py-3 font-semibold">Employee</th>}
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Workstation</th>
              <th className="px-5 py-3 font-semibold">Check-in</th>
              <th className="px-5 py-3 font-semibold">Check-out</th>
              <th className="px-5 py-3 font-semibold">Duration</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s._id} className="transition-colors hover:bg-slate-50/70">
                {showEmployee && (
                  <td className="max-w-[16rem] px-5 py-3">
                    <Employee employee={s.employeeId} />
                  </td>
                )}
                <td className="whitespace-nowrap px-5 py-3 text-slate-700">{formatDateKey(s.date)}</td>
                <td className="px-5 py-3">
                  <ModeBadge session={s} />
                </td>
                <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600">{formatTime(s.checkIn)}</td>
                <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600">
                  {s.checkOut ? formatTime(s.checkOut) : <span className="text-emerald-600">In progress</span>}
                </td>
                <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums text-ink">
                  <Duration session={s} />
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBadge status={s.status} />
                    <AutoTag session={s} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {sessions.map((s) => (
          <li key={s._id} className="space-y-2.5 px-4 py-4">
            {showEmployee && <Employee employee={s.employeeId} />}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{formatDateKey(s.date)}</span>
              <span className="inline-flex items-center gap-1.5">
                <StatusBadge status={s.status} />
                <AutoTag session={s} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <ModeBadge session={s} />
              <span className={cn('tabular-nums text-slate-600')}>
                {formatTime(s.checkIn)} – {s.checkOut ? formatTime(s.checkOut) : 'now'} ·{' '}
                <strong className="text-ink">
                  <Duration session={s} />
                </strong>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default SessionTable;
