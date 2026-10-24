import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, CalendarOff, Info, Megaphone, MessageSquare, MessagesSquare, Pin, Send, Trash2, UserX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { getErrorMessage } from '../services/api';
import { Alert, Avatar, Button, Card, EmptyState, PageContainer, Pill, Skeleton, useConfirm, useToast } from '../components/ui';
import { useDocumentTitle } from '../hooks';
import { cn } from '../lib/utils';

const MAX_LENGTH = 2000;
const GROUP_GAP_MS = 5 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const time = (v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function dayHeading(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dateKey(today)) return 'Today';
  if (key === dateKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function awayLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === todayKey()) return 'Today';
  if (key === dateKey(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const KINDS = {
  message: { label: 'Message', icon: MessageSquare, placeholder: 'Write a message to everyone…' },
  absence: { label: 'Absence note', icon: UserX, placeholder: 'Let the team know why you’ll be away…' },
  announcement: { label: 'Announcement', icon: Megaphone, placeholder: 'Share an announcement with the whole company…' },
};

const ABSENCE_REASONS = ['Sick leave', 'Personal leave', 'Doctor’s appointment', 'Family emergency', 'Working off-site'];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'absence', label: 'Absences' },
];

function MessageActions({ canDelete, onDelete }) {
  if (!canDelete) return null;
  return (
    <button
      type="button"
      onClick={onDelete}
      className="shrink-0 self-center rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
      aria-label="Delete message"
      title="Delete message"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function Deleted() {
  return <p className="text-sm italic text-slate-400">This message was deleted.</p>;
}

function Announcement({ message, canDelete, onDelete }) {
  return (
    <div id={`msg-${message._id}`} className="group flex scroll-mt-24 gap-2 py-2">
      <div className="min-w-0 flex-1 rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="brand" icon={Megaphone}>
            Announcement
          </Pill>
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
            <Avatar person={message.author} size="xs" />
            <span className="truncate">{message.author.name}</span>
          </span>
          <span className="text-xs text-slate-500">{time(message.createdAt)}</span>
        </div>
        {message.deleted ? (
          <div className="mt-2">
            <Deleted />
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{message.text}</p>
        )}
      </div>
      <MessageActions canDelete={canDelete && !message.deleted} onDelete={onDelete} />
    </div>
  );
}

function Bubble({ message, mine, showHeader, canDelete, onDelete }) {
  const absence = message.kind === 'absence';
  return (
    <div id={`msg-${message._id}`} className={cn('group flex scroll-mt-24 gap-3', mine && 'flex-row-reverse', showHeader ? 'mt-4' : 'mt-1')}>
      <div className="w-9 shrink-0">{showHeader && !mine && <Avatar person={message.author} size="sm" />}</div>
      <div className={cn('flex min-w-0 max-w-[min(36rem,85%)] flex-col', mine ? 'items-end' : 'items-start')}>
        {showHeader && (
          <p className={cn('mb-1 flex items-center gap-2 text-xs', mine && 'flex-row-reverse')}>
            <span className="font-semibold text-ink">{mine ? 'You' : message.author.name}</span>
            {message.author.role === 'admin' && !mine && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Admin</span>
            )}
            <span className="text-slate-400">{time(message.createdAt)}</span>
          </p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5',
            absence
              ? 'border border-amber-200 bg-amber-50'
              : mine
                ? 'rounded-tr-md bg-brand-100'
                : 'rounded-tl-md bg-slate-100',
            absence && (mine ? 'rounded-tr-md' : 'rounded-tl-md')
          )}
          title={showHeader ? undefined : time(message.createdAt)}
        >
          {absence && !message.deleted && (
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
              Away · {awayLabel(message.absenceDate)}
            </p>
          )}
          {message.deleted ? <Deleted /> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{message.text}</p>}
        </div>
      </div>
      <MessageActions canDelete={canDelete && !message.deleted} onDelete={onDelete} />
    </div>
  );
}

function Composer({ isAdmin }) {
  const { send } = useChat();
  const toast = useToast();
  const [kind, setKind] = useState('message');
  const [text, setText] = useState('');
  const [absenceDate, setAbsenceDate] = useState(todayKey);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);

  // Grow with the text, up to about six lines.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const kinds = isAdmin ? ['message', 'absence', 'announcement'] : ['message', 'absence'];
  const trimmed = text.trim();
  const over = text.length > MAX_LENGTH;

  const submit = async (event) => {
    event?.preventDefault();
    if (!trimmed || over || sending) return;
    setSending(true);
    setError('');
    try {
      await send({ kind, text: trimmed, absenceDate: kind === 'absence' ? absenceDate : undefined });
      setText('');
      if (kind !== 'message') {
        toast.success(kind === 'announcement' ? 'Announcement posted to everyone' : 'Absence note shared with the team');
        setKind('message');
      }
      textRef.current?.focus();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send your message.'));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
      {error && (
        <Alert tone="error" className="mb-3" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Message type">
        {kinds.map((k) => {
          const Icon = KINDS[k].icon;
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setKind(k)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                active
                  ? k === 'absence'
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                    : k === 'announcement'
                      ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-200'
                      : 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {KINDS[k].label}
            </button>
          );
        })}
      </div>

      {kind === 'absence' && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
          <label htmlFor="absence-date" className="text-xs font-semibold text-amber-800">
            Away on
          </label>
          <input
            id="absence-date"
            type="date"
            value={absenceDate}
            min={todayKey()}
            onChange={(e) => setAbsenceDate(e.target.value || todayKey())}
            className="input h-8 w-auto py-0 text-xs"
          />
          <span className="mx-1 hidden h-4 w-px bg-amber-200 sm:block" aria-hidden="true" />
          {ABSENCE_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setText((t) => (t.trim() ? t : `${reason}: `))}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-ink hover:ring-slate-300"
            >
              {reason}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border bg-white p-1.5 pl-3 transition-colors focus-within:border-brand-500',
          over ? 'border-rose-400' : 'border-slate-300'
        )}
      >
        <textarea
          ref={textRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={KINDS[kind].placeholder}
          aria-label={KINDS[kind].placeholder}
          className="max-h-[168px] min-h-[36px] flex-1 resize-none border-0 bg-transparent py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <Button type="submit" size="icon" disabled={!trimmed || over} loading={sending} aria-label="Send message" title="Send (Enter)">
          {!sending && <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-slate-400">
        <span>
          <kbd className="font-sans font-semibold">Enter</kbd> to send · <kbd className="font-sans font-semibold">Shift + Enter</kbd> for a new line
        </span>
        {text.length > MAX_LENGTH - 200 && (
          <span className={cn('tabular-nums', over && 'font-semibold text-rose-600')}>
            {text.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}

function AwayPanel({ messages }) {
  const today = todayKey();
  const upcoming = useMemo(() => {
    const latest = new Map(); // one entry per person per day
    messages
      .filter((m) => m.kind === 'absence' && !m.deleted && m.absenceDate >= today)
      .forEach((m) => latest.set(`${m.author._id}-${m.absenceDate}`, m));
    return [...latest.values()].sort((a, b) => a.absenceDate.localeCompare(b.absenceDate)).slice(0, 8);
  }, [messages, today]);

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarOff className="h-4 w-4 text-amber-600" aria-hidden="true" /> Who’s away
      </p>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nobody has posted an absence note for the coming days.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {upcoming.map((m) => (
            <li key={m._id}>
              <a href={`#msg-${m._id}`} className="flex items-start gap-2.5 rounded-lg p-1 -m-1 transition hover:bg-slate-50">
                <Avatar person={m.author} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{m.author.name}</span>
                  <span className="block text-xs font-semibold text-amber-700">{awayLabel(m.absenceDate)}</span>
                  <span className="line-clamp-2 text-xs text-slate-500">{m.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ChatPage() {
  useDocumentTitle('Team chat');
  const { user, isAdmin } = useAuth();
  const { onlineIds } = useSocket();
  const { messages, pinned, hasMore, loaded, loadingOlder, lastReadAt, loadLatest, loadOlder, remove, setChatOpen } = useChat();
  const confirm = useConfirm();
  const toast = useToast();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [newBelow, setNewBelow] = useState(0);

  const scrollRef = useRef(null);
  const nearBottom = useRef(true);
  const prevCount = useRef(0);
  const restoreFrom = useRef(null);

  useEffect(() => {
    setChatOpen(true);
    return () => setChatOpen(false);
  }, [setChatOpen]);

  useEffect(() => {
    if (!loaded) loadLatest().catch((err) => setError(getErrorMessage(err, 'Could not load the chat.')));
  }, [loaded, loadLatest]);

  const visible = useMemo(() => (filter === 'all' ? messages : messages.filter((m) => m.kind === filter)), [messages, filter]);

  // First unread message from someone else, for the "New messages" divider (fixed for this visit).
  const firstUnreadId = useMemo(() => {
    if (!lastReadAt) return null;
    const since = new Date(lastReadAt).getTime();
    return messages.find((m) => new Date(m.createdAt).getTime() > since && String(m.author._id) !== String(user?._id))?._id || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastReadAt, loaded]);

  // Keep the view pinned to the newest message, unless the reader scrolled up to read history.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else {
      const added = visible.length - prevCount.current;
      const last = visible[visible.length - 1];
      const mineLast = last && String(last.author._id) === String(user?._id);
      if (prevCount.current === 0 || nearBottom.current || mineLast) {
        el.scrollTop = el.scrollHeight;
        setNewBelow(0);
      } else if (added > 0) {
        setNewBelow((n) => n + added);
      }
    }
    prevCount.current = visible.length;
  }, [visible, user?._id]);

  const onScroll = () => {
    const el = scrollRef.current;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom.current) setNewBelow(0);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewBelow(0);
  };

  const older = async () => {
    restoreFrom.current = scrollRef.current.scrollHeight - scrollRef.current.scrollTop;
    try {
      await loadOlder();
    } catch (err) {
      restoreFrom.current = null;
      toast.error(getErrorMessage(err, 'Could not load earlier messages.'));
    }
  };

  const handleDelete = async (message) => {
    const ok = await confirm({
      title: 'Delete this message?',
      message: 'It will be removed for everyone in the team chat.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove(message._id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete the message.'));
    }
  };

  const onlineCount = onlineIds.size;

  let lastDay = null;
  let prev = null;

  return (
    <PageContainer size="lg" className="flex flex-1 flex-col">
      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <Card className="flex h-[calc(100dvh-8.5rem)] min-h-[480px] flex-col overflow-hidden sm:h-[calc(100dvh-10rem)]">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <MessagesSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight text-ink">Team chat</h1>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Everyone at the company · {onlineCount} online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Filter messages">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-semibold transition-colors',
                    filter === f.id ? 'bg-white text-ink shadow-card' : 'text-slate-500 hover:text-ink'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pinned announcement */}
          {pinned && !pinned.deleted && (
            <a
              href={`#msg-${pinned._id}`}
              className="flex items-start gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2.5 transition hover:bg-brand-100 sm:px-5"
            >
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-brand-800">
                  Pinned announcement · {pinned.author.name} · {dayHeading(dateKey(new Date(pinned.createdAt)))}
                </span>
                <span className="line-clamp-1 text-sm text-ink">{pinned.text}</span>
              </span>
            </a>
          )}

          {/* Messages */}
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
              {error && <Alert tone="error">{error}</Alert>}
              {!loaded && !error && (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cn('flex gap-3', i % 2 && 'flex-row-reverse')}>
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-14 w-1/2 rounded-2xl" />
                    </div>
                  ))}
                </div>
              )}

              {loaded && hasMore && filter === 'all' && (
                <div className="mb-3 flex justify-center">
                  <Button variant="secondary" size="sm" loading={loadingOlder} onClick={older}>
                    Load earlier messages
                  </Button>
                </div>
              )}

              {loaded && visible.length === 0 && (
                <EmptyState
                  icon={filter === 'absence' ? CalendarOff : filter === 'announcement' ? Megaphone : MessagesSquare}
                  title={filter === 'all' ? 'Say hello to the team' : filter === 'absence' ? 'No absence notes yet' : 'No announcements yet'}
                  description={
                    filter === 'all'
                      ? 'Messages here are seen by everyone. Use an absence note to tell the team when you’ll be away.'
                      : 'They will appear here as soon as someone posts one.'
                  }
                />
              )}

              {visible.map((m) => {
                const day = dateKey(new Date(m.createdAt));
                const newDay = day !== lastDay;
                const mine = String(m.author._id) === String(user?._id);
                const showHeader =
                  newDay ||
                  !prev ||
                  prev.kind === 'announcement' ||
                  m.kind === 'announcement' ||
                  String(prev.author._id) !== String(m.author._id) ||
                  new Date(m.createdAt) - new Date(prev.createdAt) > GROUP_GAP_MS;
                lastDay = day;
                prev = m;
                const canDelete = mine || isAdmin;
                return (
                  <Fragment key={m._id}>
                    {newDay && (
                      <div className="my-4 flex items-center gap-3" role="separator">
                        <span className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs font-semibold text-slate-500">{dayHeading(day)}</span>
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                    )}
                    {m._id === firstUnreadId && (
                      <div className="my-3 flex items-center gap-3" role="separator">
                        <span className="h-px flex-1 bg-rose-300" />
                        <span className="text-xs font-semibold text-rose-600">New messages</span>
                        <span className="h-px flex-1 bg-rose-300" />
                      </div>
                    )}
                    {m.kind === 'announcement' ? (
                      <Announcement message={m} canDelete={canDelete} onDelete={() => handleDelete(m)} />
                    ) : (
                      <Bubble message={m} mine={mine} showHeader={showHeader} canDelete={canDelete} onDelete={() => handleDelete(m)} />
                    )}
                  </Fragment>
                );
              })}
            </div>

            {newBelow > 0 && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-pop"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                {newBelow} new message{newBelow > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <Composer isAdmin={isAdmin} />
        </Card>

        <aside className="hidden space-y-6 lg:block">
          <AwayPanel messages={messages} />
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Info className="h-4 w-4 text-brand-700" aria-hidden="true" /> How to use the chat
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              <li className="flex gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Messages are seen by everyone at the company.
              </li>
              <li className="flex gap-2">
                <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  Post an <strong className="font-semibold text-ink">absence note</strong> when you won’t be in — everyone is notified.
                </span>
              </li>
              <li className="flex gap-2">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                {isAdmin ? 'As an admin you can post announcements; the latest one stays pinned.' : 'Admins post announcements; the latest one stays pinned at the top.'}
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

export default ChatPage;
