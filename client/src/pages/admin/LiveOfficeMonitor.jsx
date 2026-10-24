import { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { SafeOfficeScene } from '../../components/office3d/SafeOfficeScene';
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Pill } from '../../components/ui';
import { useDocumentTitle, useElapsedSeconds } from '../../hooks';
import { cn, formatDuration } from '../../lib/utils';

function WorkerRow({ desk, active, onSelect, away }) {
  const session = desk.currentSessionId && typeof desk.currentSessionId === 'object' ? desk.currentSessionId : null;
  const elapsed = useElapsedSeconds(session?.checkIn);
  // Prefer the person actually working here over the desk's assignee.
  const emp = (session?.employeeId && typeof session.employeeId === 'object' ? session.employeeId : null) || desk.employeeId;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(desk.deskId)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50'
        )}
      >
        <Avatar person={emp} name={emp?.name || desk.assignedEmployeeName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{emp?.name || desk.assignedEmployeeName || 'Admin session'}</span>
          <span className="block font-mono text-xs text-slate-500">
            {desk.deskId}
            {session?.mode === 'remote' ? ' · Remote' : ''}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-semibold tabular-nums text-emerald-700">{session ? formatDuration(elapsed) : '—'}</span>
          {away && <Pill tone="warning">Away</Pill>}
        </span>
      </button>
    </li>
  );
}

export function LiveOfficeMonitor() {
  useDocumentTitle('Live office');
  const { desks, isConnected, isUserAway } = useSocket();
  const [focus, setFocus] = useState({ deskId: null, key: 0 });

  const working = useMemo(() => desks.filter((d) => d.status === 'working'), [desks]);
  const available = useMemo(() => desks.filter((d) => !d.locked && d.status !== 'working').length, [desks]);

  const select = (deskId) => setFocus((f) => ({ deskId, key: f.key + 1 }));

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Live office"
        description="See who is checked in right now and jump to any desk in the 3D office."
        actions={
          <div className="flex flex-wrap gap-2">
            <Pill tone="success">{working.length} working</Pill>
            <Pill tone="brand">{available} available</Pill>
            <Pill tone={isConnected ? 'success' : 'neutral'}>{isConnected ? 'Live' : 'Reconnecting…'}</Pill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="flex max-h-[640px] flex-col overflow-hidden">
          <CardHeader title="Checked in" description="Click a person to locate their desk" />
          {working.length === 0 ? (
            <EmptyState icon={Radio} title="Nobody is checked in" description="Office check-ins will appear here instantly." />
          ) : (
            <ul className="space-y-1 overflow-y-auto p-2">
              {working.map((desk) => (
                <WorkerRow
                  key={desk.deskId}
                  desk={desk}
                  active={focus.deskId === desk.deskId}
                  onSelect={select}
                  away={isUserAway(desk.currentSessionId?.employeeId?._id)}
                />
              ))}
            </ul>
          )}
        </Card>

        <div className="h-[640px] overflow-hidden rounded-xl border border-slate-200 shadow-card">
          <SafeOfficeScene focusDeskId={focus.deskId} focusKey={focus.key} />
        </div>
      </div>
    </>
  );
}

export default LiveOfficeMonitor;
