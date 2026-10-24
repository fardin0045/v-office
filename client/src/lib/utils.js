import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const avatarFor = (person) =>
  person?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(person?.name || 'user')}`;

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

const pad = (n) => String(n).padStart(2, '0');

// 3725 -> "01:02:05"
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// 3725 -> "1h 2m"
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return s > 0 ? '< 1m' : '0m';
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

// "2026-09-23" -> "Wed, Sep 23, 2026" without timezone drift.
export function formatDateKey(dateKey) {
  if (!dateKey) return '—';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const timeAgo = (value) => {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString();
};

export const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export async function celebrate() {
  try {
    const { default: confetti } = await import('canvas-confetti');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.75 }, colors: ['#53ece9', '#2dd9d6', '#10b981', '#ffffff'] });
  } catch {
    // Decorative only.
  }
}

// Where a session happened: "DESK-01 · Office", "DESK-01 · Remote", or just "Remote".
export const sessionPlace = (session) => {
  if (!session) return '';
  const mode = session.mode === 'remote' ? 'Remote' : 'Office';
  return session.deskId ? `${session.deskId} · ${mode}` : mode;
};
