import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Modal } from './Modal';

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);

const TOAST_TONES = {
  success: { icon: CheckCircle2, color: 'text-emerald-600' },
  error: { icon: XCircle, color: 'text-rose-600' },
  warning: { icon: AlertTriangle, color: 'text-amber-600' },
  info: { icon: Info, color: 'text-brand-700' },
};

const MAX_TOASTS = 4;

/** App-wide toasts (`useToast`) and promise-based confirmation dialogs (`useConfirm`). */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone, message, { title, duration = 4500 } = {}) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, tone, message, title }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss]
  );

  const [dialog, setDialog] = useState(null);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setDialog({ confirmLabel: 'Confirm', cancelLabel: 'Cancel', tone: 'primary', size: 'sm', ...options, resolve });
      }),
    []
  );
  const settle = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        {/* Resolves true (confirm), false (cancel button) or null (dismissed with Esc / X / backdrop). */}
        <Modal
          open={Boolean(dialog)}
          onClose={() => settle(null)}
          title={dialog?.title}
          size={dialog?.size || 'sm'}
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)} data-autofocus={dialog?.tone === 'danger' || undefined}>
                {dialog?.cancelLabel}
              </Button>
              <Button
                variant={dialog?.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                data-autofocus={dialog?.tone !== 'danger' || undefined}
              >
                {dialog?.confirmLabel}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600">{dialog?.message}</p>
        </Modal>

        {createPortal(
          <div
            className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:w-96"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((t) => {
              const { icon: Icon, color } = TOAST_TONES[t.tone] || TOAST_TONES.info;
              return (
                <div
                  key={t.id}
                  role={t.tone === 'error' ? 'alert' : 'status'}
                  className="pointer-events-auto flex w-full animate-slide-up items-start gap-3 rounded-xl border border-slate-200 bg-elevated p-4 shadow-pop"
                >
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', color)} aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-sm">
                    {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                    <p className={cn(t.title ? 'mt-0.5 text-slate-600' : 'font-medium text-slate-800')}>{t.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within FeedbackProvider');
  return context;
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within FeedbackProvider');
  return context;
}
