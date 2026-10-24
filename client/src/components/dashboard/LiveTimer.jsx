import { Building2, Clock, Laptop, Square } from 'lucide-react';
import { useElapsedSeconds } from '../../hooks';
import { formatClock, formatTime, sessionPlace } from '../../lib/utils';
import { Button } from '../ui';

// Large running clock for an active work session.
export function LiveTimer({ activeSession, onEndSession, loading }) {
  const elapsed = useElapsedSeconds(activeSession?.checkIn);
  const [hh, mm, ss] = formatClock(elapsed).split(':');
  const isOffice = activeSession?.mode !== 'remote';

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Session in progress
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {isOffice ? <Building2 className="h-3.5 w-3.5 text-brand-700" /> : <Laptop className="h-3.5 w-3.5 text-brand-700" />}
          {sessionPlace(activeSession)}
        </span>
      </div>

      <div className="my-8 flex items-end justify-center gap-2 font-mono sm:gap-3" aria-live="off">
        {[
          [hh, 'hours'],
          [mm, 'minutes'],
          [ss, 'seconds'],
        ].map(([value, label], i) => (
          <div key={label} className="flex items-end gap-2 sm:gap-3">
            {i > 0 && <span className="pb-6 text-3xl font-bold text-emerald-300 sm:text-4xl">:</span>}
            <div className="text-center">
              <div className="text-5xl font-bold tabular-nums tracking-tight text-ink sm:text-6xl">{value}</div>
              <div className="mt-1 font-sans text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Started at <strong className="font-semibold text-ink">{formatTime(activeSession.checkIn)}</strong>
        </span>
        {onEndSession && (
          <Button variant="danger" leftIcon={Square} loading={loading} onClick={onEndSession}>
            {loading ? 'Ending…' : 'Check out'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default LiveTimer;
