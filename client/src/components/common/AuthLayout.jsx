import { CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';

const POINTS = [
  'Check in at your desk in the 3D office with one click',
  'See who is in the office or remote, in real time',
  'Accurate timesheets and attendance, automatically',
];

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-canvas lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-10 top-16 h-80 w-80 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-36 h-80 w-80 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-900/70">V-Office</p>
          <h2 className="mt-4 max-w-md text-4xl font-bold leading-tight tracking-tight text-brand-950">
            Your hybrid workplace, in one virtual space.
          </h2>
        </div>
        <ul className="relative space-y-4">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-brand-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="font-medium">{point}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
