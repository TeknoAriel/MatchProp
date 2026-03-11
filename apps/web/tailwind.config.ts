import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        mp: {
          bg: 'var(--mp-bg)',
          card: 'var(--mp-card)',
          foreground: 'var(--mp-foreground)',
          muted: 'var(--mp-muted)',
          accent: 'var(--mp-accent)',
          premium: 'var(--mp-premium)',
          border: 'var(--mp-border)',
        },
        kiteprop: {
          primary: '#2563eb',
          violet: '#7c3aed',
          rose: '#f43f5e',
          sky: '#0284c7',
        },
        card: {
          DEFAULT: 'var(--mp-card)',
          muted: 'var(--mp-bg)',
        },
      },
      borderRadius: {
        card: '20px',
        chip: '12px',
        'card-lg': '24px',
      },
      boxShadow: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
      },
      minHeight: {
        tap: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
