// `rgb(var(--name) / <alpha-value>)` keeps opacity modifiers such as `bg-white/95` working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name, shades = SHADES) => Object.fromEntries(shades.map((shade) => [shade, token(`${name}-${shade}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',

  theme: {
    extend: {
      // Every colour the UI uses is a CSS variable (see index.css), so the whole app switches between
      // the day and night themes by toggling the `dark` class on <html> — no per-component dark: classes.
      colors: {
        white: token('white'),
        slate: scale('slate'),
        emerald: scale('emerald', SHADES.slice(0, -1)),
        rose: scale('rose', SHADES.slice(0, -1)),
        amber: scale('amber', SHADES.slice(0, -1)),
        // Brand scale built around #53ece9 (brand-300 / DEFAULT).
        // Use brand-700+ for text on surfaces; 300–400 for fills with `text-brand-ink`.
        brand: {
          DEFAULT: '#53ece9',
          ...scale('brand'),
          ink: '#052f2f', // text on brand fills, identical in both themes
        },
        canvas: token('canvas'),
        elevated: token('elevated'), // menus, popovers and modals
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          subtle: token('ink-subtle'),
        },
        // Fixed colours that must not change with the theme.
        snow: '#ffffff',
        night: { DEFAULT: '#0f172a', 800: '#1e293b', 950: '#020617' },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      boxShadow: {
        // Per-theme values live in index.css (dark mode uses highlights + deeper shadows).
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        pop: 'var(--shadow-pop)',
        brand: '0 8px 24px -6px rgba(45, 217, 214, 0.55)',
      },

      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        float: 'float 5s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },

  plugins: [],
};
