import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { SafeOfficeScene } from '../components/office3d/SafeOfficeScene';
import { useDocumentTitle } from '../hooks';
import { cn } from '../lib/utils';

export function VirtualOfficePage() {
  useDocumentTitle('Virtual office');
  const [searchParams] = useSearchParams();
  const focusDeskId = searchParams.get('desk');
  const focusRoom = searchParams.get('room') === 'meeting';
  const { desks, isConnected } = useSocket();

  const stats = useMemo(() => {
    const working = desks.filter((d) => d.status === 'working').length;
    const locked = desks.filter((d) => d.locked).length;
    return { total: desks.length, working, available: Math.max(0, desks.length - working - locked) };
  }, [desks]);

  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[480px] w-full">
      <SafeOfficeScene focusDeskId={focusDeskId} focusRoom={focusRoom} />

      <div className="pointer-events-none absolute bottom-3 right-3 z-30 hidden md:block">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 shadow-card backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
            <strong className="text-ink tabular-nums">{stats.total}</strong> desks
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <strong className="tabular-nums">{stats.working}</strong> working
          </span>
          <span className="inline-flex items-center gap-1.5 text-brand-800">
            <strong className="tabular-nums">{stats.available}</strong> available
          </span>
          <span className={cn('inline-flex items-center gap-1.5', isConnected ? 'text-emerald-600' : 'text-slate-400')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default VirtualOfficePage;
