import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building, Building2, Laptop, Lock, Play, ShieldCheck, Square, Unlock, UserX, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useWorkSession } from '../../context/WorkSessionContext';
import { deskAPI, getErrorMessage } from '../../services/api';
import { useElapsedSeconds } from '../../hooks';
import { celebrate, formatClock, formatTime, sessionPlace } from '../../lib/utils';
import { Alert, Avatar, Button, StatusBadge, useConfirm, useToast } from '../ui';

function Notice({ tone = 'neutral', icon: Icon, title, children }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div className={`rounded-xl border p-3.5 text-sm ${tones[tone]}`}>
      {title && (
        <p className="flex items-center gap-1.5 font-semibold">
          {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {title}
        </p>
      )}
      <div className={title ? 'mt-1 text-[13px] leading-relaxed opacity-90' : ''}>{children}</div>
    </div>
  );
}

export function ChairFloatingPanel({ desk, onClose }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { activeSession, startWork, endWork } = useWorkSession();
  const { isUserAway } = useSocket();
  const toast = useToast();
  const confirm = useConfirm();

  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  const deskSession = desk.currentSessionId && typeof desk.currentSessionId === 'object' ? desk.currentSessionId : null;
  const isLocked = Boolean(desk.locked);
  const isWorking = desk.status === 'working' || Boolean(deskSession);
  const elapsed = useElapsedSeconds(isWorking ? deskSession?.checkIn : null);

  const assignee = desk.employeeId && typeof desk.employeeId === 'object' ? desk.employeeId : null;
  // Whoever is working here right now (a remote worker may be using a desk that isn't theirs).
  const occupant = deskSession?.employeeId && typeof deskSession.employeeId === 'object' ? deskSession.employeeId : null;
  const person = (isWorking && occupant) || assignee;
  const isAway = isWorking && Boolean(occupant) && isUserAway(occupant._id);
  const isGuest = Boolean(occupant && assignee && occupant._id !== assignee._id) || Boolean(occupant && !assignee);
  const isMine = Boolean(user?.assignedDesk && user.assignedDesk === desk.deskId);
  const isMySession = Boolean(activeSession && activeSession.deskId === desk.deskId);
  const isRemoteMode = user?.workMode === 'remote';
  // Office mode: only your assigned desk. Remote mode: your desk or any free, unassigned desk.
  const canUseDesk = isMine || isAdmin || (isRemoteMode && !desk.employeeId);
  const busyElsewhere = Boolean(activeSession && !isMySession);
  const returnUrl = encodeURIComponent(`/office?desk=${desk.deskId}`);

  const run = async (key, action) => {
    setPending(key);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const handleStart = () =>
    run('start', async () => {
      await startWork({ deskId: desk.deskId, mode: isRemoteMode ? 'remote' : 'office' });
      celebrate();
      toast.success(
        isRemoteMode
          ? `Working remotely from ${desk.deskId}. Your team can see you in the office.`
          : `Checked in at ${desk.deskId}. Have a great day!`
      );
    });

  const handleEnd = async () => {
    if (!isMySession) {
      const ok = await confirm({
        title: `End ${person?.name || 'this employee'}’s session?`,
        message: 'Their work session will be closed now and the recorded time saved to their history.',
        confirmLabel: 'End session',
        tone: 'danger',
      });
      if (!ok) return;
    }
    run('end', async () => {
      await endWork(deskSession?._id || activeSession?._id);
      toast.success(isMySession ? 'Checked out. Your session has been saved.' : `Session at ${desk.deskId} ended.`);
    });
  };

  const handleToggleLock = () =>
    run('lock', async () => {
      await deskAPI.toggleLock({ deskId: desk.deskId, locked: !isLocked });
      toast.success(`${desk.deskId} ${isLocked ? 'unlocked' : 'locked'}`);
    });

  const handleUnassign = async () => {
    const ok = await confirm({
      title: `Unassign ${desk.deskId}?`,
      message: isWorking
        ? `${assignee?.name || 'The assignee'} is currently checked in here. Their session will be ended and the desk freed.`
        : `${assignee?.name || 'The assignee'} will no longer be able to check in at this desk.`,
      confirmLabel: 'Unassign',
      tone: 'danger',
    });
    if (!ok) return;
    run('unassign', async () => {
      await deskAPI.unassignDesk({ deskId: desk.deskId });
      toast.success(`${desk.deskId} is now unassigned`);
    });
  };

  let primary;
  if (!isAuthenticated) {
    primary = (
      <div className="space-y-2">
        <p className="text-center text-sm text-slate-500">Sign in to check in at this workstation.</p>
        <Button as={Link} to={`/login?returnUrl=${returnUrl}`} className="w-full" rightIcon={ArrowRight}>
          Sign in to work
        </Button>
      </div>
    );
  } else if (isLocked && !isWorking) {
    primary = (
      <Notice icon={Lock} title="Workstation locked">
        An administrator has locked this desk. It can’t be used right now.
      </Notice>
    );
  } else if (isWorking) {
    primary =
      isMySession || isAdmin ? (
        <Button variant="danger" className="w-full" size="lg" leftIcon={Square} loading={pending === 'end'} onClick={handleEnd}>
          {isMySession ? 'Check out' : 'End this session'}
        </Button>
      ) : (
        <Notice>This workstation is currently in use by a colleague.</Notice>
      );
  } else if (!canUseDesk) {
    primary = (
      <Notice tone="warning" icon={AlertTriangle} title="Not your workstation">
        {isRemoteMode
          ? 'This desk belongs to a colleague. In remote mode you can use your own desk or any unassigned desk.'
          : user?.assignedDesk
            ? `In office mode you can only check in at your assigned desk, ${user.assignedDesk}. Switch to remote mode to use a free desk.`
            : 'You don’t have a desk yet. Switch to remote mode to use any free desk, or ask an administrator to assign one.'}
      </Notice>
    );
  } else if (busyElsewhere) {
    primary = (
      <Notice tone="warning" icon={AlertTriangle} title="You’re already checked in">
        You have an active session ({sessionPlace(activeSession)}). Check out first to start working here.{' '}
        <Link to="/dashboard" className="font-semibold underline">
          Go to dashboard
        </Link>
      </Notice>
    );
  } else {
    primary = (
      <div className="space-y-2">
        <Button variant="success" className="w-full" size="lg" leftIcon={Play} loading={pending === 'start'} onClick={handleStart}>
          {isRemoteMode ? 'Start remote work here' : 'Start work'}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          {isRemoteMode ? <Laptop className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
          Logged as {isRemoteMode ? 'remote' : 'office'} work at {desk.deskId}
        </p>
      </div>
    );
  }

  return (
    <section
      className="absolute inset-x-3 bottom-3 z-40 max-h-[calc(100%-1.5rem)] animate-slide-up overflow-y-auto rounded-2xl border border-slate-200 bg-elevated/95 p-5 shadow-pop backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[23rem]"
      aria-label={`Workstation ${desk.deskId}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold tracking-tight text-ink">{desk.deskId}</h2>
            <span className="font-mono text-xs text-slate-400">{desk.chairId}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-700">
            <Building className="h-3 w-3" aria-hidden="true" /> {desk.zoneName || desk.zone}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={isLocked ? 'locked' : isAway ? 'away' : isWorking ? 'working' : desk.status} />
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="error" className="mt-4" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        <Avatar person={person} name={person?.name || desk.assignedEmployeeName || 'Unassigned'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
            {person?.name || desk.assignedEmployeeName || 'Unassigned workstation'}
            {(isMySession || (!isWorking && isMine)) && (
              <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">YOU</span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">
            {person?.title || (desk.employeeId ? 'Employee' : 'Available for assignment')}
          </p>
          {isWorking && isGuest ? (
            <p className="text-[11px] text-slate-400">
              {assignee ? `Using ${assignee.name.split(' ')[0]}’s desk` : 'Using a free desk'}
            </p>
          ) : (
            person?.employeeId && <p className="font-mono text-[11px] text-slate-400">{person.employeeId}</p>
          )}
        </div>
      </div>

      {isAway && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <strong className="font-semibold">Away</strong> — {occupant?.name?.split(' ')[0] || 'they'} closed V-Office
          {deskSession?.lastSeenAt ? ` at ${formatTime(deskSession.lastSeenAt)}` : ''}. The session ends automatically if they
          don’t return.
        </p>
      )}
      {isWorking ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-700">
            <span>Current session · {deskSession?.mode === 'remote' ? 'Remote' : 'Office'}</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-bold uppercase tracking-wide ring-1 ring-emerald-200">Live</span>
          </div>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-800">{formatClock(elapsed)}</p>
          {deskSession?.checkIn && <p className="text-xs text-emerald-700/80">Since {formatTime(deskSession.checkIn)}</p>}
        </div>
      ) : (
        <p className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
          <span className="text-slate-500">Today’s status</span>
          <span className="font-medium text-slate-700">{isLocked ? 'Locked' : 'Not started'}</span>
        </p>
      )}

      <div className="mt-4">{primary}</div>

      {isAdmin && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" /> Admin controls
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={isLocked ? Unlock : Lock}
              loading={pending === 'lock'}
              onClick={handleToggleLock}
            >
              {isLocked ? 'Unlock' : 'Lock'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={UserX}
              loading={pending === 'unassign'}
              onClick={handleUnassign}
              disabled={!desk.employeeId}
              className="hover:border-rose-300 hover:text-rose-700"
            >
              Unassign
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default ChairFloatingPanel;
