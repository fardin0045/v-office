import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const TONES = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: Info, iconColor: 'text-brand-700' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, iconColor: 'text-emerald-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconColor: 'text-amber-600' },
  error: { box: 'border-rose-200 bg-rose-50 text-rose-900', icon: XCircle, iconColor: 'text-rose-600' },
};

export function Alert({ tone = 'info', title, children, onClose, className }) {
  const { box, icon: Icon, iconColor } = TONES[tone] || TONES.info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-fade-in', box, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'leading-relaxed opacity-90')}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 rounded-md p-1 opacity-60 transition hover:bg-slate-900/5 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default Alert;
