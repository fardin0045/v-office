import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarClock, CalendarPlus, Clock, ExternalLink, LogOut, Pencil, Presentation, Square, Trash2, Users, Video, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { activeParticipants, useMeetings } from '../../context/MeetingsContext';
import { getErrorMessage } from '../../services/api';
import { cn } from '../../lib/utils';
import { Alert, Avatar, Button, Pill, useConfirm, useToast } from '../ui';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';

const time = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (d) => {
  const date = new Date(d);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};
const minutesUntil = (d, now) => Math.max(0, Math.ceil((new Date(d).getTime() - now) / 60000));

function Participants({ meeting }) {
  const people = activeParticipants(meeting);
  if (people.length === 0) return <p className="text-xs text-slate-500">Nobody has joined yet.</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {people.slice(0, 8).map((p) => (
        <span key={p.user._id} title={p.user.name} className="inline-flex items-center gap-1 rounded-full bg-white py-0.5 pl-0.5 pr-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
          <Avatar person={p.user} size="xs" />
          {p.user.name.split(' ')[0]}
        </span>
      ))}
      {people.length > 8 && <span className="text-xs text-slate-500">+{people.length - 8} more</span>}
    </div>
  );
}

export function MeetingPanel({ onClose }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const { meetings, current, upcoming, recent, isInMeeting, myMeeting, now, join, leave, end, cancel } = useMeetings();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // null | { meeting?: object }

  const focus = current || upcoming.find((m) => m.status === 'joinable') || null;
  const later = upcoming.filter((m) => m._id !== focus?._id).slice(0, 5);

  const run = async (key, fn, success) => {
    setPending(key);
    setError('');
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const handleJoin = (meeting) => {
    // Open the call synchronously (inside the click) so browsers don't block the new tab.
    window.open(meeting.link, '_blank', 'noopener,noreferrer');
    run(`join-${meeting._id}`, () => join(meeting._id), `You joined “${meeting.title}”`);
  };

  const handleLeave = (meeting) => run(`leave-${meeting._id}`, () => leave(meeting._id), 'You left the meeting');

  const handleEnd = async (meeting) => {
    const ok = await confirm({
      title: `End “${meeting.title}” now?`,
      message: 'Everyone in the meeting will be removed from the room and the meeting will be marked as ended.',
      confirmLabel: 'End meeting',
      tone: 'danger',
    });
    if (ok) run(`end-${meeting._id}`, () => end(meeting._id), 'Meeting ended');
  };

  const handleCancel = async (meeting) => {
    const ok = await confirm({
      title: `Cancel “${meeting.title}”?`,
      message: 'The meeting will be removed from the schedule for everyone.',
      confirmLabel: 'Cancel meeting',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (ok) run(`cancel-${meeting._id}`, () => cancel(meeting._id), 'Meeting cancelled');
  };

  let body;
  if (!isAuthenticated) {
    body = (
      <div className="space-y-3 text-center">
        <p className="text-sm text-slate-500">Sign in to see meetings and join them online.</p>
        <Button as={Link} to={`/login?returnUrl=${encodeURIComponent('/office?room=meeting')}`} className="w-full" rightIcon={ArrowRight}>
          Sign in
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        {focus ? (
          <div
            className={cn(
              'rounded-xl border p-4',
              focus.status === 'live' ? 'border-emerald-200 bg-emerald-50' : 'border-brand-200 bg-brand-50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold', focus.status === 'live' ? 'text-emerald-700' : 'text-brand-800')}>
                  {focus.status === 'live' ? '● Live now' : `Starts in ${minutesUntil(focus.startsAt, now)} min`}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-ink">{focus.title}</h3>
                <p className="text-xs text-slate-500">
                  {time(focus.startsAt)} – {time(focus.endsAt)}
                  {focus.createdBy?.name ? ` · by ${focus.createdBy.name}` : ''}
                </p>
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditor({ meeting: focus })} aria-label="Edit meeting" title="Edit meeting">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {focus.description && <p className="mt-2 text-sm text-slate-600">{focus.description}</p>}
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" /> In the room ({activeParticipants(focus).length})
              </p>
              <Participants meeting={focus} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {isInMeeting(focus) ? (
                <>
                  <Button as="a" href={focus.link} target="_blank" rel="noopener noreferrer" variant="success" size="sm" leftIcon={ExternalLink}>
                    Open call
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={LogOut} loading={pending === `leave-${focus._id}`} onClick={() => handleLeave(focus)}>
                    Leave
                  </Button>
                </>
              ) : (
                <Button variant="success" size="sm" leftIcon={Video} loading={pending === `join-${focus._id}`} onClick={() => handleJoin(focus)}>
                  Join meeting
                </Button>
              )}
              {isAdmin && focus.status === 'live' && (
                <Button variant="danger-ghost" size="sm" leftIcon={Square} loading={pending === `end-${focus._id}`} onClick={() => handleEnd(focus)}>
                  End
                </Button>
              )}
              {isAdmin && focus.status !== 'live' && (
                <Button variant="danger-ghost" size="sm" leftIcon={Trash2} loading={pending === `cancel-${focus._id}`} onClick={() => handleCancel(focus)}>
                  Cancel
                </Button>
              )}
            </div>
            {myMeeting && myMeeting._id !== focus._id && (
              <p className="mt-3 text-xs text-amber-700">You are still in “{myMeeting.title}”.</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <Presentation className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="mt-1.5 text-sm font-medium text-slate-700">The room is free right now</p>
            <p className="text-xs text-slate-500">
              {isAdmin ? 'Schedule a meeting and everyone will be notified.' : 'Upcoming meetings appear here. You can join 10 minutes before they start.'}
            </p>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming</p>
          {later.length === 0 ? (
            <p className="text-sm text-slate-500">No other meetings scheduled.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {later.map((m) => (
                <li key={m._id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold leading-tight text-brand-800">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{m.title}</span>
                    <span className="block text-xs text-slate-500">
                      {day(m.startsAt)} · {time(m.startsAt)} – {time(m.endsAt)}
                    </span>
                  </span>
                  {isAdmin && (
                    <span className="flex shrink-0 gap-0.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditor({ meeting: m })} aria-label={`Edit ${m.title}`} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="danger-ghost" size="icon-sm" loading={pending === `cancel-${m._id}`} onClick={() => handleCancel(m)} aria-label={`Cancel ${m.title}`} title="Cancel">
                        {pending !== `cancel-${m._id}` && <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {recent.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Earlier today</p>
            <ul className="space-y-1.5">
              {recent.slice(0, 3).map((m) => (
                <li key={m._id} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">{m.title}</span>
                  <span className="shrink-0">
                    {time(m.startsAt)} · {(m.participants || []).length} attended
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isAdmin && (
          <Button className="mt-4 w-full" leftIcon={CalendarPlus} onClick={() => setEditor({})}>
            Schedule meeting
          </Button>
        )}
      </>
    );
  }

  return (
    <section
      className="absolute inset-x-3 bottom-3 z-40 max-h-[calc(100%-1.5rem)] animate-slide-up overflow-y-auto rounded-2xl border border-slate-200 bg-elevated/95 p-5 shadow-pop backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[24rem]"
      aria-label="Meeting room"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
            <Presentation className="h-5 w-5 text-brand-700" aria-hidden="true" /> Meeting Room
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
            <Clock className="h-3 w-3" aria-hidden="true" /> 10 seats · online meetings
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isAuthenticated && (current ? <Pill tone="success">Live</Pill> : <Pill tone="brand">{meetings.length ? 'Scheduled' : 'Free'}</Pill>)}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="error" className="mb-4" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {body}

      {editor && <ScheduleMeetingModal meeting={editor.meeting} onClose={() => setEditor(null)} />}
    </section>
  );
}

export default MeetingPanel;
