import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-400 active:bg-brand-500 shadow-sm',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger: 'bg-rose-600 text-snow hover:bg-rose-700 active:bg-rose-800 shadow-sm dark:bg-rose-300 dark:hover:bg-rose-200 dark:active:bg-rose-200',
  'danger-ghost': 'text-rose-600 hover:bg-rose-50 active:bg-rose-100',
  success: 'bg-emerald-600 text-snow hover:bg-emerald-700 active:bg-emerald-800 shadow-sm dark:bg-emerald-300 dark:hover:bg-emerald-200 dark:active:bg-emerald-200',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-sm',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
};

export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    className,
    children,
    ...props
  },
  ref
) {
  const isButton = Component === 'button';
  const isDisabled = disabled || loading;
  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Component
      ref={ref}
      type={isButton ? props.type || 'button' : undefined}
      disabled={isButton ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Spinner className={iconSize} /> : LeftIcon && <LeftIcon className={iconSize} aria-hidden="true" />}
      {children}
      {!loading && RightIcon && <RightIcon className={iconSize} aria-hidden="true" />}
    </Component>
  );
});

export default Button;
