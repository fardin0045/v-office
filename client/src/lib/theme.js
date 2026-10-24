import { useSyncExternalStore } from 'react';

// Day/night theme. The class on <html> is the source of truth (set before first paint by
// public/theme-init.js); an explicit choice is remembered, otherwise the OS setting is followed.
const KEY = 'voffice_theme';
const THEME_COLOR = { light: '#53ece9', dark: '#0a0f14' };
const listeners = new Set();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readSaved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

let current =
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

function apply(theme) {
  current = theme;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  listeners.forEach((listener) => listener());
}

if (media) {
  apply(readSaved() || (media.matches ? 'dark' : 'light'));
  media.addEventListener?.('change', (event) => {
    if (!readSaved()) apply(event.matches ? 'dark' : 'light');
  });
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* not persisted, still applied for this visit */
  }
  apply(theme);
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => 'light');
  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}
