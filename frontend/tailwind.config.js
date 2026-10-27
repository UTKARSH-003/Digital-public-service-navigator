/** @type {import('tailwindcss').Config} */
// All colours resolve to CSS variables defined in src/styles/tokens.css: change the palette there only.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--color-background)',
        ink: 'var(--color-foreground)',
        grey: 'var(--color-secondary)', // decorative / large text only (3.4:1 on paper)
        'grey-strong': 'var(--color-secondary-strong)', // small secondary text (AA)
        muted: 'var(--color-muted)',
        echo: { 1: 'var(--color-echo-1)', 2: 'var(--color-echo-2)', 3: 'var(--color-echo-3)', 4: 'var(--color-echo-4)' },
        surface: 'var(--color-surface)',
        dark: 'var(--color-dark)',
        'footer-text': 'var(--color-footer-text)',
        line: 'var(--border-subtle)',
        'line-strong': 'var(--border-strong)',
        ok: { DEFAULT: 'var(--status-ok)', bg: 'var(--status-ok-bg)' },
        caution: { DEFAULT: 'var(--status-caution)', bg: 'var(--status-caution-bg)' },
        danger: { DEFAULT: 'var(--status-danger)', bg: 'var(--status-danger-bg)' },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        serif: ['var(--font-serif)'],
      },
      fontSize: {
        // fluid display scale (hero is separate: see .t-hero)
        'display-xl': ['clamp(3rem, 8vw, 7rem)', { lineHeight: '0.9', letterSpacing: '-0.05em' }],
        'display-lg': ['clamp(2.25rem, 5.5vw, 4.5rem)', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
        'display-md': ['clamp(1.75rem, 3.4vw, 2.75rem)', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        'display-sm': ['clamp(1.375rem, 2.2vw, 1.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      maxWidth: { page: '90rem' },
      keyframes: { slide: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } } },
      transitionDuration: { fast: 'var(--transition-fast)', reveal: 'var(--transition-reveal)' },
      transitionTimingFunction: { editorial: 'var(--ease-editorial)' },
    },
  },
  plugins: [],
};
