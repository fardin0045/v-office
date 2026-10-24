import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/common/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { getErrorMessage } from '../services/api';
import { useDocumentTitle } from '../hooks';

// One-click demo accounts (seeded by `npm run seed`). Shown in development by default; production builds
// only show them when VITE_ENABLE_DEMO_LOGIN=true, since they reveal working credentials.
const DEMO_SETTING = import.meta.env.VITE_ENABLE_DEMO_LOGIN;
const SHOW_DEMO = DEMO_SETTING ? DEMO_SETTING === 'true' : import.meta.env.DEV;

const DEMO_ACCOUNTS = [
  { label: 'Employee', detail: 'Maya Patel · DESK-03', email: 'maya.p@voffice.local', password: 'Employee123!', icon: User },
  { label: 'Administrator', detail: 'Full admin access', email: 'admin@voffice.local', password: 'Admin123!', icon: Shield },
];

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const returnUrl = searchParams.get('returnUrl');
  const registerHref = returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      // On success the GuestRoute wrapper redirects to `returnUrl` (or the dashboard).
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to check in at your desk and see your team."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={registerHref} className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Input
          label="Work email"
          type="email"
          icon={Mail}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        <Button type="submit" size="lg" className="w-full" loading={loading} rightIcon={ArrowRight}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="mt-8">
          <div className="relative text-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true" />
            <span className="relative bg-white px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Try a demo account
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account)}
                className="flex items-start gap-3 rounded-xl border border-[#53ece9] p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <account.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{account.label}</span>
                  <span className="block text-xs text-slate-500">{account.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default LoginPage;
