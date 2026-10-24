import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

function FieldShell({ id, label, hint, error, required, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, icon: Icon, className, inputClassName, id: idProp, type = 'text', required, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={id}
          type={isPassword && revealed ? 'text' : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            'input',
            Icon && 'pl-9',
            isPassword && 'pr-10',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-100',
            inputClassName
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, className, selectClassName, id: idProp, required, children, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('input cursor-pointer pr-8', selectClassName)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
