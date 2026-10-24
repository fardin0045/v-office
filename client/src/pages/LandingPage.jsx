import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  Laptop,
  Lock,
  MousePointerClick,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/common/Footer';
import { Button } from '../components/ui';
import { useDocumentTitle } from '../hooks';
import { cn } from '../lib/utils';

const STEPS = [
  {
    icon: Boxes,
    title: 'Enter the 3D office',
    body: 'Explore a realistic floor plan with five zones. Orbit, zoom, or jump straight to your desk.',
  },
  {
    icon: MousePointerClick,
    title: 'Click your chair to check in',
    body: 'Access control verifies it’s your assigned seat, then your work timer starts instantly.',
  },
  {
    icon: Radio,
    title: 'Your team sees it live',
    body: 'Presence updates in real time for everyone — no refreshing, no status messages to post.',
  },
];

const FEATURES = [
  { icon: Building2, title: 'Interactive 3D floor', body: '30 workstations across five zones, rendered in the browser with camera presets.' },
  { icon: ShieldCheck, title: 'Seat-level access control', body: 'Employees can only check in at their own desk. Admins can lock or reassign any seat.' },
  { icon: Users, title: 'Real-time presence', body: 'See who is in the office, who is remote and who just checked out — as it happens.' },
  { icon: Clock, title: 'Automatic timesheets', body: 'Every session is logged to the second, with filterable history for every employee.' },
  { icon: BarChart3, title: 'Attendance analytics', body: 'Daily trends, office vs. remote split and department insights for leadership.' },
  { icon: Laptop, title: 'Built for hybrid', body: 'Switch between office and remote mode. Remote days are tracked with the same accuracy.' },
];

const ZONES = [
  ['Zone A', 'Front open office', '7 desks'],
  ['Zone B', 'Guest lounge area', '4 desks'],
  ['Zone C', 'Collaboration pods', '8 desks'],
  ['Zone D', 'Executive suite', '1 desk'],
  ['Zone E', 'Engineering wing', '10 desks'],
];

// Decorative floor-plan preview; statuses are illustrative.
const PREVIEW_DESKS = [
  'working', 'available', 'working', 'available', 'available', 'working',
  'available', 'locked', 'working', 'available', 'working', 'available',
  'available', 'working', 'available', 'working', 'available', 'available',
];

const PREVIEW_STYLES = {
  working: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  available: 'border-brand-300 bg-brand-50 text-brand-800',
  locked: 'border-slate-200 bg-slate-100 text-slate-400',
};

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl animate-slide-up">
      <div className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2.5rem] bg-white/40 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 hidden rounded-md bg-white px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-200 sm:block">
            v-office / virtual-office
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_260px]">
          <div className="bg-[radial-gradient(rgb(var(--slate-200))_1px,transparent_1px)] p-5 [background-size:18px_18px] sm:p-8">
            <div className="grid grid-cols-6 gap-2 sm:gap-3">
              {PREVIEW_DESKS.map((status, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex aspect-[4/3] flex-col items-center justify-center rounded-lg border text-[10px] font-semibold sm:text-xs',
                    PREVIEW_STYLES[status],
                    i === 2 && 'ring-2 ring-brand-500 ring-offset-2'
                  )}
                >
                  {status === 'locked' ? <Lock className="h-3.5 w-3.5" /> : `D-${String(i + 1).padStart(2, '0')}`}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-400" /> Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Working
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" /> Locked
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 p-5 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected desk</p>
            <p className="mt-1 text-lg font-bold text-ink">DESK-03</p>
            <p className="text-xs text-slate-500">Front open office</p>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">Work session in progress</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-800">02:14:08</p>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Verified seat owner
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Time logged automatically
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  useDocumentTitle();

  return (
    <div className="flex flex-col bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-white/50">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#53ece9] px-3 py-1 text-xs font-semibold text-brand-ink shadow-sm ring-1 ring-white">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              THE HYBRID OFFICE PLATFORM
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-brand-950 sm:text-6xl">
              Your hybrid workplace,{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">in one virtual space</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded bg-white/60 sm:bottom-2 sm:h-4" aria-hidden="true" />
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-950/80">
              V-Office brings office and remote teams together in an interactive 3D floor plan. Check in at your
              desk with one click, see who&apos;s working in real time, and get accurate attendance without the admin.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button as={Link} to="/office" size="lg" variant="dark" leftIcon={Boxes} className="w-full sm:w-auto">
                Enter virtual office
              </Button>
              <Button
                as={Link}
                to={isAuthenticated ? '/dashboard' : '/login'}
                variant="secondary"
                size="lg"
                rightIcon={ArrowRight}
                className="w-full border-[#53ece9]  sm:w-auto"
              >
                {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-brand-950/80">
              {['Real-time presence', 'Seat-level access control', 'Attendance analytics'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand-900" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-y border-[#53ece9] bg-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
          {[
            ['30', 'Workstations'],
            ['5', 'Office zones'],
            ['< 1s', 'Presence updates'],
            ['100%', 'Browser-based'],
          ].map(([value, label]) => (
            <div key={label} className="bg-white px-6 py-8 text-center">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 text-3xl font-bold tracking-tight text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section className="bg-canvas py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">From login to at-your-desk in seconds</h2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="card relative p-6 transition-shadow hover:shadow-card-hover bg-canvas border-[#53ece9]">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-brand-950">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-300 dark:text-slate-500">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Everything in one place</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Built for teams that work anywhere
            </h2>
            <p className="mt-4 text-slate-600">
              Presence, attendance and workspace management — without spreadsheets or chat check-ins.
            </p>
          </div>
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 border-[#53ece9] ">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#53ece9] text-brand-700 ring-1 ring-brand-100">
                  <Icon className="h-5 w-5 " aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zones */}
      <section className="border-y border-[#53ece9] bg-canvas py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8 ">
          <div>
            <p className="eyebrow">A real office layout</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              30 workstations across five purpose-built zones
            </h2>
            <p className="mt-4 text-slate-600">
              Modelled on real corporate floor plans, so finding your desk — or a colleague — feels familiar from day one.
            </p>
          </div>
          <div className="card divide-y divide-[#53ece9]">
            {ZONES.map(([zone, name, count]) => (
              <div key={zone} className="flex items-center justify-between gap-4 px-5 py-4 border-[#53ece9]">
                <div className="flex items-center gap-3 ">
                  <span className="rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand-800">{zone}</span>
                  <span className="font-medium text-ink">{name}</span>
                </div>
                <span className="text-sm text-slate-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-canvas px-6 py-14 text-center sm:px-12">
          <div className="absolute -right-36 -top-16 h-56 w-56 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
          <div className="absolute -bottom-26 -left-40 h-56 w-56 rounded-full bg-[#53ece9] blur-3xl dark:opacity-20" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Step into your hybrid office today</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-700">
              Open the virtual office right now — no install required. Sign in to check in at your desk.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button as={Link} to="/office" size="lg" leftIcon={Boxes}>
                Launch virtual office
              </Button>
              {!isAuthenticated && (
                <Button as={Link} to="/register" size="lg" variant="secondary" className="border-transparent">
                  Create an account
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default LandingPage;
