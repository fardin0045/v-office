import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Building2, CalendarDays, Clock, History, Laptop, MapPin, Play, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkSession } from '../context/WorkSessionContext';
import { workAPI, getErrorMessage } from '../services/api';
import { LiveTimer } from '../components/dashboard/LiveTimer';
import { WeeklyHoursChart, WorkModeDonutChart } from '../components/dashboard/AnalyticsCharts';
import { SessionTable } from '../components/dashboard/SessionTable';
import { MeetingsCard } from '../components/dashboard/MeetingsCard';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageContainer,
  PageHeader,
  Skeleton,
  StatCard,
  useConfirm,
  useToast,
} from '../components/ui';
import { useDocumentTitle } from '../hooks';
import { celebrate, cn } from '../lib/utils';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

function StartWorkPanel({ user, onStartRemote, starting }) {
  if (user.workMode === 'remote') {
    return (
      <EmptyState
        icon={Laptop}
        title="Working remotely today?"
        description="Sit at a virtual desk so your team sees you in the 3D office — your own desk or any free one — or just log remote time."
        action={
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              as={Link}
              to={user.assignedDesk ? `/office?desk=${user.assignedDesk}` : '/office'}
              leftIcon={Boxes}
            >
              {user.assignedDesk ? 'Work from my desk' : 'Choose a desk'}
            </Button>
            <Button variant="secondary" leftIcon={Play} loading={starting} onClick={onStartRemote}>
              Start without a desk
            </Button>
          </div>
        }
      />
    );
  }

  if (!user.assignedDesk) {
    return (
      <EmptyState
        icon={MapPin}
        title="No desk assigned yet"
        description="Ask an administrator to assign you a workstation, or switch to remote mode to log work from anywhere."
      />
    );
  }

  return (
    <EmptyState
      icon={Building2}
      title="Ready to start your day?"
      description={`Head to ${user.assignedDesk} in the virtual office and click your chair to check in.`}
      action={
        <Button as={Link} to={`/office?desk=${user.assignedDesk}`} leftIcon={Boxes}>
          Go to my desk
        </Button>
      }
    />
  );
}

function WorkModeCard({ user }) {
  const { toggleWorkMode } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const change = async (mode) => {
    if (mode === user.workMode || pending) return;
    setPending(true);
    try {
      await toggleWorkMode(mode);
      toast.success(`Switched to ${mode} mode`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change work mode'));
    } finally {
      setPending(false);
    }
  };

  const options = [
    { mode: 'office', icon: Building2, title: 'Office', body: 'Check in by clicking your chair in the 3D office.' },
    { mode: 'remote', icon: Laptop, title: 'Remote', body: 'Work from anywhere — from your own or any free virtual desk.' },
  ];

  return (
    <Card>
      <CardHeader title="Work mode" description="How you’re working today" />
      <div className="space-y-3 p-5" role="radiogroup" aria-label="Work mode">
        {options.map(({ mode, icon: Icon, title, body }) => {
          const active = user.workMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => change(mode)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition',
                active
                  ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-brand text-brand-ink' : 'bg-slate-100 text-slate-500'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="block text-xs text-slate-500">{body}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { activeSession, loading: sessionLoading, revision, startWork, endWork } = useWorkSession();
  const toast = useToast();
  const confirm = useConfirm();

  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([workAPI.getStats(), workAPI.getHistory({ limit: 5 })]);
      setStats(statsRes.data);
      setRecentSessions(historyRes.data.sessions || []);
      setLoadError('');
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the user's sessions change (here, in another tab, or by an admin).
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, revision]);

  const handleStartRemote = async () => {
    setActionLoading(true);
    try {
      await startWork({ mode: 'remote' });
      celebrate();
      toast.success('Remote session started. Have a productive day!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start remote work.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    const ok = await confirm({
      title: 'Check out now?',
      message: 'Your current work session will end and its duration will be saved to your history.',
      confirmLabel: 'Check out',
      tone: 'danger',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      await endWork(activeSession?._id);
      toast.success('Checked out. Your session has been saved.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not end your session.'));
    } finally {
      setActionLoading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${firstName}`}
        description={[user?.title, user?.department].filter(Boolean).join(' · ')}
        actions={
          <Button as={Link} to="/office" leftIcon={Boxes}>
            Open virtual office
          </Button>
        }
      />

      {loadError && (
        <Alert tone="error" className="mb-6" title="Something went wrong">
          {loadError}{' '}
          <button type="button" onClick={loadDashboard} className="font-semibold underline">
            Try again
          </button>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={stats?.todayHours ?? '0.0'}
          unit="hrs"
          hint={activeSession ? 'Includes your running session' : 'No active session'}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          label="Last 7 days"
          value={stats?.weeklyHours ?? '0.0'}
          unit="hrs"
          hint="Rolling week, including today"
          icon={TrendingUp}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="This month"
          value={stats?.monthlyHours ?? '0.0'}
          unit="hrs"
          hint="Since the 1st of the month"
          icon={CalendarDays}
          tone="warning"
          loading={loading}
        />
        <StatCard
          label="Assigned desk"
          value={user?.assignedDesk || '—'}
          hint={user?.assignedDesk ? 'Managed by your administrator' : 'Not assigned yet'}
          icon={MapPin}
          tone="neutral"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sessionLoading ? (
            <Card className="p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mx-auto my-10 h-16 w-72" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ) : activeSession ? (
            <LiveTimer activeSession={activeSession} onEndSession={handleEndSession} loading={actionLoading} />
          ) : (
            <Card className="flex h-full items-center justify-center">
              <StartWorkPanel user={user} onStartRemote={handleStartRemote} starting={actionLoading} />
            </Card>
          )}
        </div>
        <WorkModeCard user={user} />
      </div>

      <div className="mt-6">
        <MeetingsCard />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Hours worked" description="Daily totals for the last 7 days" />
          <div className="p-5">{loading ? <Skeleton className="h-64 w-full" /> : <WeeklyHoursChart data={stats?.weeklyChartData} />}</div>
        </Card>
        <Card>
          <CardHeader title="Office vs. remote" description="Sessions in the last 30 days" />
          <div className="p-5">
            {loading ? (
              <Skeleton className="mx-auto h-48 w-48 rounded-full" />
            ) : (
              <WorkModeDonutChart officeCount={stats?.officeCount} remoteCount={stats?.remoteCount} />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Recent sessions"
          description="Your latest check-ins"
          action={
            <Button as={Link} to="/history" variant="ghost" size="sm" rightIcon={ArrowRight}>
              View all
            </Button>
          }
        />
        <SessionTable
          sessions={recentSessions}
          loading={loading}
          empty={<EmptyState icon={History} title="No sessions yet" description="Your work sessions will show up here." />}
        />
      </Card>
    </PageContainer>
  );
}

export default DashboardPage;
