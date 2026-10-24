import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Skeleton } from './Spinner';

export function PageContainer({ className, children, size = 'xl' }) {
  const width = { md: 'max-w-4xl', lg: 'max-w-6xl', xl: 'max-w-7xl' }[size];
  return <main className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8', width, className)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, unit, hint, icon: Icon, tone = 'brand', loading = false, className }) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    neutral: 'bg-slate-100 text-slate-600',
    dark: 'bg-night text-brand ring-1 ring-slate-200',
  }[tone];

  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneClass)}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-3xl font-bold tracking-tight text-ink tabular-nums">
          {value}
          {unit && <span className="ml-1 text-base font-medium text-slate-400">{unit}</span>}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange, label = 'results', className }) {
  if (!pages || pages <= 1) {
    return total ? (
      <p className={cn('px-5 py-3 text-sm text-slate-500', className)}>
        {total} {label}
      </p>
    ) : null;
  }

  return (
    <nav
      className={cn('flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3', className)}
      aria-label="Pagination"
    >
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of{' '}
        <span className="font-semibold text-slate-700">{pages}</span>
        <span className="hidden sm:inline">
          {' '}
          · {total} {label}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={ChevronLeft}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={ChevronRight}
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>
    </nav>
  );
}
