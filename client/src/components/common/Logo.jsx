import { Link } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LogoMark({ className }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-sm ring-1 ring-brand-400/40',
        className
      )}
      aria-hidden="true"
    >
      <Boxes className="h-5 w-5" strokeWidth={2.25} />
    </span>
  );
}

export function Logo({ to = '/', className, subtitle = true }) {
  return (
    <Link to={to} className={cn('group flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg', className)} aria-label="V-Office home">
      <LogoMark className="transition-transform group-hover:scale-105" />
      <span className="leading-tight">
        <span className="block text-[17px] font-bold tracking-tight text-ink">V-OFFICE</span>
        {subtitle && (
          <span className="hidden text-[11px] font-medium text-slate-500 sm:block">Hybrid workplace</span>
        )}
      </span>
    </Link>
  );
}

export default Logo;
