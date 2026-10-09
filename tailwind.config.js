/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral surfaces and text, defined as CSS variables in index.css for light and dark.
        canvas: token('canvas'),
        sidebar: token('sidebar'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        accent: token('accent'),
        'accent-soft': token('accent-soft'),
        // Indigo accent scale.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)',
        composer: '0 2px 6px rgb(0 0 0 / 0.04), 0 8px 28px rgb(0 0 0 / 0.07)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'xp-rise': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.8)' },
          '30%': { opacity: '1', transform: 'translateY(0) scale(1.1)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': { '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.96)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'confetti-fall': {
          '0%': { transform: 'translate3d(0, -10vh, 0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translate3d(var(--drift), 105vh, 0) rotate(var(--spin))', opacity: '0.9' },
        },
        flicker: { '0%, 100%': { transform: 'scale(1) rotate(-3deg)' }, '50%': { transform: 'scale(1.12) rotate(3deg)' } },
      },
      animation: {
        pop: 'pop 320ms ease-out',
        shake: 'shake 380ms ease-in-out',
        'xp-rise': 'xp-rise 500ms ease-out both',
        'toast-in': 'toast-in 280ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'confetti-fall': 'confetti-fall var(--dur) cubic-bezier(0.25, 0.6, 0.4, 1) var(--delay) both',
        flicker: 'flicker 900ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
