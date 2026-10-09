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
    },
  },
  plugins: [],
};
