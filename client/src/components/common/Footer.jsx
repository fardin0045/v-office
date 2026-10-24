import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

const LINKS = [
  { to: '/office', label: 'Virtual office' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'Work history' },
  { to: '/login', label: 'Sign in' },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-canvas text-brand-950">
      <div className="absolute -left-62 -top-32 h-96 w-1/3 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="V-Office home">
              <LogoMark className="bg-white ring-white" />
              <span className="text-lg font-bold tracking-tight">V-OFFICE</span>
            </Link>
            <p className="text-sm text-brand-950/75">
              Your hybrid workplace, in one virtual space. Real-time presence and attendance for teams that work anywhere.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-950/60">Product</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2 text-sm font-medium">
              {LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="underline-offset-4 hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-brand-950/15 pt-6 text-sm text-brand-950/70 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} V-Office. All rights reserved.</p>
          <p>Built for hybrid teams.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
