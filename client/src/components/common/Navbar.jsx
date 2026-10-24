import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  History,
  LayoutDashboard,
  Laptop,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Shield,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { useWorkSession } from '../../context/WorkSessionContext';
import { useDismiss, useElapsedSeconds } from '../../hooks';
import { useTheme } from '../../lib/theme';
import { cn, formatClock, sessionPlace, timeAgo } from '../../lib/utils';
import { getErrorMessage } from '../../services/api';
import { Avatar, Button, useConfirm, useToast } from '../ui';
import { Logo } from './Logo';

const NAV_LINKS = [
  { label: 'Virtual Office', to: '/office', icon: Boxes, public: true },
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Work History', to: '/history', icon: History },
  { label: 'Team Chat', to: '/chat', icon: MessagesSquare, badge: 'chat' },
];

// Unread team-chat messages, shown next to the "Team Chat" link.
function ChatBadge({ className }) {
  const { unread } = useChat();
  if (!unread) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-snow dark:bg-rose-300',
        className
      )}
      aria-label={`${unread} unread`}
    >
      {unread > 99 ? '99+' : unread}
    </span>
  );
}

const navLinkClass = ({ isActive }) =>
  cn(
    'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
  );

// Isolated so the once-per-second tick doesn't re-render the whole navbar.
function SessionPill() {
  const { activeSession } = useWorkSession();
  const elapsed = useElapsedSeconds(activeSession?.checkIn);

  if (!activeSession) {
    return (
      <Link
        to="/dashboard"
        className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-slate-300 sm:inline-flex"
      >
        <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
        Not checked in
      </Link>
    );
  }

  return (
    <Link
      to={activeSession.deskId ? `/office?desk=${activeSession.deskId}` : '/dashboard'}
      className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 pl-3 pr-1.5 text-xs font-semibold text-emerald-800 hover:border-emerald-300 sm:inline-flex"
      title="Active work session"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-mono tabular-nums">{formatClock(elapsed)}</span>
      <span className="hidden rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 lg:inline">
        {sessionPlace(activeSession)}
      </span>
    </Link>
  );
}

function WorkModeToggle({ className }) {
  const { user, toggleWorkMode } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(null);

  const change = async (mode) => {
    if (mode === user.workMode || pending) return;
    setPending(mode);
    try {
      await toggleWorkMode(mode);
      toast.success(`Switched to ${mode} mode`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change work mode'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className={cn('inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5', className)}
      role="radiogroup"
      aria-label="Work mode"
    >
      {[
        { mode: 'office', label: 'Office', icon: Building2 },
        { mode: 'remote', label: 'Remote', icon: Laptop },
      ].map(({ mode, label, icon: Icon }) => {
        const active = user.workMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => change(mode)}
            disabled={Boolean(pending)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all',
              active ? 'bg-white text-ink shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-ink'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', active && 'text-brand-700')} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to day theme' : 'Switch to night theme';
  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  );
}

function NotificationsMenu() {
  const { notifications, unreadCount, markNotificationsRead, isConnected } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false), open);

  const toggle = () => {
    setOpen((v) => !v);
    markNotificationsRead();
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-snow dark:bg-rose-300">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-slide-up rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-white px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium',
                isConnected ? 'text-emerald-600' : 'text-slate-400'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
              {isConnected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Nothing yet. Check-ins, check-outs and meetings will appear here.
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.type === 'meeting'
                        ? 'bg-brand-500'
                        : n.type === 'announcement'
                          ? 'bg-violet-500'
                          : n.type === 'absence'
                            ? 'bg-amber-500'
                            : n.type === 'success'
                              ? 'bg-emerald-500'
                              : 'bg-slate-300'
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="text-xs text-slate-500">
                      {n.message} · {timeAgo(n.time)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ onSignOut }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 2xl:pr-2"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <Avatar person={user} size="sm" />
        <span className="hidden text-left 2xl:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-ink">{user.name}</span>
          <span className="block text-[11px] font-medium leading-tight text-slate-500">
            {user.assignedDesk || (user.role === 'admin' ? 'Administrator' : 'No desk')}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 2xl:block" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 animate-slide-up rounded-xl border border-slate-200 bg-elevated p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {user.employeeId} · {user.role}
            </p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-sm text-slate-700">Work mode</span>
            <WorkModeToggle />
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <User className="h-4 w-4 text-slate-400" /> My profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { activeSession, endWork } = useWorkSession();
  const confirm = useConfirm();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const signOut = async () => {
    if (activeSession) {
      const choice = await confirm({
        title: 'You’re still checked in',
        message: `Your session (${sessionPlace(activeSession)}) is still running. Check out now, or keep working and sign out? If you keep working, you’ll show as Away and be checked out automatically if you don’t come back.`,
        confirmLabel: 'Check out & sign out',
        cancelLabel: 'Keep working & sign out',
        size: 'md',
      });
      if (choice === null) return; // dialog dismissed: stay signed in
      if (choice) {
        try {
          await endWork(activeSession._id);
          toast.success('Checked out. Your session has been saved.');
        } catch (err) {
          toast.error(getErrorMessage(err, 'Could not check out. You are still signed in.'));
          return;
        }
      }
    }
    logout();
    navigate('/login');
  };

  const links = NAV_LINKS.filter((link) => link.public || isAuthenticated);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-lg supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:max-w-[88rem]">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6 xl:gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} className={navLinkClass} title={label} aria-label={label}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">{label}</span>
                {badge === 'chat' && <ChatBadge />}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass} title="Admin" aria-label="Admin">
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">Admin</span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <SessionPill />
              <NotificationsMenu />
              <div className="hidden md:block">
                <UserMenu onSignOut={signOut} />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button as={Link} to="/register" size="sm">
                Get started
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-menu" className="animate-fade-in border-t border-slate-200 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {isAuthenticated && (
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <Avatar person={user} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            )}
            {links.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} className={(s) => cn(navLinkClass(s), 'flex w-full')}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {badge === 'chat' && <ChatBadge className="ml-auto" />}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={(s) => cn(navLinkClass(s), 'flex w-full')}>
                <Shield className="h-4 w-4" aria-hidden="true" />
                Admin
              </NavLink>
            )}
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className={(s) => cn(navLinkClass(s), 'flex w-full')}>
                  <User className="h-4 w-4" aria-hidden="true" />
                  My profile
                </NavLink>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm font-medium text-slate-600">Work mode</span>
                  <WorkModeToggle />
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button as={Link} to="/login" variant="secondary">
                  Sign in
                </Button>
                <Button as={Link} to="/register">
                  Get started
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
