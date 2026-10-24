import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Image as ImageIcon, Lock, Mail, MapPin, RefreshCw, Save, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workAPI, getErrorMessage } from '../services/api';
import { Avatar, Button, Card, CardHeader, Input, PageContainer, PageHeader, Pill, Skeleton, useToast } from '../components/ui';
import { useDocumentTitle } from '../hooks';
import { isHttpUrl } from '../lib/utils';

const MIN_PASSWORD = 8;

export function ProfilePage() {
  useDocumentTitle('My profile');
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);

  // Re-sync the form if the profile changes elsewhere (e.g. another tab).
  useEffect(() => {
    setName(user?.name || '');
    setAvatar(user?.avatar || '');
  }, [user?.name, user?.avatar]);

  useEffect(() => {
    let cancelled = false;
    workAPI
      .getStats()
      .then((res) => !cancelled && setStats(res.data))
      .catch(() => !cancelled && setStats({}));
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = name.trim() !== (user?.name || '') || avatar.trim() !== (user?.avatar || '') || password.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = {};
    if (name.trim().length < 2) found.name = 'Please enter your name';
    if (avatar.trim() && !isHttpUrl(avatar.trim())) found.avatar = 'Enter a valid image URL starting with http(s)://';
    if (password && password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters`;
    if (password && !currentPassword) found.currentPassword = 'Enter your current password to set a new one';
    if (password !== confirmPassword) found.confirmPassword = 'Passwords do not match';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const payload = { name: name.trim(), avatar: avatar.trim() };
      if (password) {
        payload.password = password;
        payload.currentPassword = currentPassword;
      }
      await updateProfile(payload);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      toast.success(password ? 'Profile and password updated' : 'Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const randomAvatar = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    setAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`);
    setErrors((e) => ({ ...e, avatar: undefined }));
  };

  return (
    <PageContainer size="lg">
      <PageHeader eyebrow="Account" title="My profile" description="Manage how you appear to your team and keep your account secure." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-6 text-center">
            <div className="relative mx-auto w-fit">
              <Avatar src={avatar || undefined} person={user} name={name} size="xl" className="ring-4 ring-brand-100" />
              <button
                type="button"
                onClick={randomAvatar}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand text-brand-ink shadow-sm transition hover:bg-brand-400"
                title="Generate a new avatar"
                aria-label="Generate a new avatar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">{user?.name}</h2>
            <p className="text-sm text-slate-500">{user?.title}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Pill tone="brand">{user?.department}</Pill>
              <Pill tone={user?.role === 'admin' ? 'dark' : 'neutral'} className="capitalize">
                {user?.role}
              </Pill>
            </div>
            <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-left text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Employee ID</dt>
                <dd className="font-mono font-medium text-ink">{user?.employeeId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Work mode</dt>
                <dd className="font-medium capitalize text-ink">{user?.workMode}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Assigned workstation</p>
              <MapPin className="h-4 w-4 text-brand-700" aria-hidden="true" />
            </div>
            <p className="mt-1 font-mono text-3xl font-bold text-ink">{user?.assignedDesk || '—'}</p>
            <p className="mt-2 text-xs text-slate-500">Desks are assigned by administrators.</p>
            {user?.assignedDesk && (
              <Button
                as={Link}
                to={`/office?desk=${user.assignedDesk}`}
                variant="secondary"
                size="sm"
                leftIcon={Boxes}
                className="mt-4 w-full"
              >
                Show in virtual office
              </Button>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-sm font-medium text-slate-500">Work summary</p>
            <dl className="mt-3 space-y-3 text-sm">
              {[
                ['Today', stats?.todayHours],
                ['Last 7 days', stats?.weeklyHours],
                ['This month', stats?.monthlyHours],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {stats ? `${value ?? '0.0'} h` : <Skeleton className="h-4 w-12" />}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader title="Account settings" description="Changes apply across V-Office immediately." />
          <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Display name"
                icon={User}
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
              />
              <Input
                label="Email"
                icon={Mail}
                type="email"
                value={user?.email || ''}
                disabled
                hint="Contact an administrator to change your email."
              />
            </div>
            <Input
              label="Avatar image URL"
              icon={ImageIcon}
              type="url"
              placeholder="https://…"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              error={errors.avatar}
              hint="Paste an image link, or use the refresh button on your photo to generate one."
            />

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-ink">Change password</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Leave blank to keep your current password. Changing it signs you out on your other devices.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Input
                  label="Current password"
                  type="password"
                  icon={Lock}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  error={errors.currentPassword}
                  maxLength={128}
                  className="sm:col-span-2"
                />
                <Input
                  label="New password"
                  type="password"
                  icon={Lock}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  hint={`At least ${MIN_PASSWORD} characters`}
                  maxLength={128}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  icon={Lock}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-6">
              <Button type="submit" leftIcon={Save} loading={saving} disabled={!isDirty}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}

export default ProfilePage;
