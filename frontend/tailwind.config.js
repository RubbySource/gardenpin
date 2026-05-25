/** @type {import('tailwindcss').Config} */
// GardenPin — Tailwind design tokens (iOS design system: SAGE + CREAM).
// Source of truth: docs/design-system.md §2–§7.
//
// The static scale (sage / ios-* / radius / shadow / motion) lives here; the
// *semantic* colors map to CSS variables defined in src/styles.css so a single
// theme switch (html[data-theme="dark"], set by ThemeToggle) flips light/dark.
//
// Notes:
//  • preflight is OFF — the app ships ~6.7k lines of hand-written CSS that must
//    not be reset. Tailwind here adds utility classes for the per-screen
//    redesign (Fáze 2) without disturbing the existing layer.
//  • darkMode follows the EXISTING [data-theme="dark"] toggle (not `.dark`),
//    so utilities like `dark:bg-surface` respond to the current switch.
//  • Default spacing scale already equals the 8pt grid
//    (1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 12=48), so it is not
//    overridden — see design-system.md §4.
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        // Brand — sage scale (static, identical light/dark)
        sage: {
          50: '#F2F6F0',
          100: '#E5EDE3',
          200: '#CBDBC7',
          300: '#A9C3A4',
          400: '#8DB089',
          500: '#7BA889',
          600: '#5F8C6E',
          700: '#4A6E57',
          800: '#38543F',
        },
        // Semantic — mapped to CSS variables (flip with the theme)
        brand: 'var(--brand)',
        'brand-strong': 'var(--brand-strong)',
        'brand-action': 'var(--brand-action)',
        'brand-action-hover': 'var(--brand-action-hover)',
        cream: 'var(--cream)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        label: 'var(--label)',
        'label-2': 'var(--label-2)',
        'label-3': 'var(--label-3)',
        separator: 'var(--separator)',
        fill: 'var(--fill)',
        // iOS system accents (state semantics)
        'ios-blue': '#0A84FF',
        'ios-green': '#34C759',
        'ios-orange': '#FF9500',
        'ios-red': '#FF3B30',
        'ios-yellow': '#FFCC00',
      },
      // Default spacing scale already equals the 8pt grid (design-system.md §4),
      // so it is not overridden — only the iOS safe-area insets are added
      // (used by the app shell / notch / home indicator, and Capacitor later).
      spacing: {
        'safe-t': 'var(--safe-top)',
        'safe-b': 'var(--safe-bottom)',
      },
      borderRadius: {
        'ios-sm': '8px',
        ios: '12px',
        'ios-md': '16px',
        'ios-lg': '20px',
        'ios-xl': '24px',
      },
      boxShadow: {
        'ios-sm': 'var(--shadow-ios-sm)',
        'ios-card': 'var(--shadow-ios-card)',
        'ios-md': 'var(--shadow-ios-md)',
        'ios-lg': 'var(--shadow-ios-lg)',
        // brand CTA / FAB glow
        'ios-brand': '0 10px 30px rgba(74, 110, 87, 0.45)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
