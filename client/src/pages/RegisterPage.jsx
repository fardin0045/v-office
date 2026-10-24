import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/common/AuthLayout';
import { Alert, Button, Input } from '../components/ui';
import { getErrorMessage } from '../services/api';
import { useDocumentTitle } from '../hooks';

const MIN_PASSWORD = 8;

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(form.employeeId.trim())) {
    errors.employeeId = 'Letters, numbers and dashes only (e.g. EMP-015)';
  }
  if (form.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters`;
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [form, setForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    department: '',
    title: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const update = (field) => (event) => {
    const next = { ...form, [field]: event.target.value };
    setForm(next);
    if (submitted) setErrors(validate(next));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      // On success the GuestRoute wrapper redirects to `returnUrl` (or the dashboard).
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        employeeId: form.employeeId.trim(),
        department: form.department.trim(),
        title: form.title.trim(),
        password: form.password,
      });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Registration failed. Please check your details.'));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join your team in the virtual office. An admin will assign your desk."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
            className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            icon={User}
            autoComplete="name"
            required
            value={form.name}
            onChange={update('name')}
            error={errors.name}
            placeholder="Jane Doe"
          />
          <Input
            label="Employee ID"
            icon={BadgeCheck}
            required
            value={form.employeeId}
            onChange={update('employeeId')}
            error={errors.employeeId}
            placeholder="EMP-015"
            inputClassName="uppercase"
          />
        </div>

        <Input
          label="Work email"
          type="email"
          icon={Mail}
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          placeholder="you@company.com"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Department"
            icon={Briefcase}
            value={form.department}
            onChange={update('department')}
            placeholder="Engineering"
          />
          <Input label="Job title" value={form.title} onChange={update('title')} placeholder="Software Engineer" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            required
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            hint={`At least ${MIN_PASSWORD} characters`}
          />
          <Input
            label="Confirm password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={errors.confirmPassword}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading} rightIcon={ArrowRight}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
