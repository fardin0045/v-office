import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

const PILL_TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  dark: 'bg-slate-900 text-white ring-slate-900',
};

export function Pill({ tone = 'neutral', className, children, icon: Icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        PILL_TONES[tone],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

// Visual language for desk / session status, shared with the 3D scene legend.
export const STATUS_META = {
  working: { label: 'Working', tone: 'success', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', tone: 'neutral', dot: 'bg-slate-400' },
  occupied: { label: 'Occupied', tone: 'warning', dot: 'bg-amber-500' },
  away: { label: 'Away', tone: 'warning', dot: 'bg-amber-500' },
  locked: { label: 'Locked', tone: 'neutral', dot: 'bg-slate-400' },
  available: { label: 'Available', tone: 'brand', dot: 'bg-brand-400' },
};

export function StatusBadge({ status, className }) {
  const key = String(status || 'available').toLowerCase();
  const meta = STATUS_META[key] || STATUS_META.available;

  return (
    <Pill tone={meta.tone} className={className}>
      {key === 'locked' ? (
        <Lock className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {key === 'working' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', meta.dot)} />
        </span>
      )}
      {meta.label}
    </Pill>
  );
}

export default StatusBadge;
