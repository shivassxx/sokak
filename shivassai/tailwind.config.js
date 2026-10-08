/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/Views/**/*.php', './public/assets/js/**/*.js'],
  safelist: ['status-gelistiriliyor', 'status-yayinda', 'status-arsiv'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        canvas: 'var(--bg)',
        'canvas-2': 'var(--bg-2)',
        'canvas-3': 'var(--bg-3)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        'line-3': 'var(--line-3)',
        accent: 'var(--accent)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { media: '20px', 'media-sm': '16px' },
      maxWidth: { site: '1320px', prose: '68ch' },
      transitionTimingFunction: { soft: 'cubic-bezier(.2,.7,.2,1)' },
    },
  },
  plugins: [],
};
