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
        /** Alineado con --mp-radius-card / --mp-radius-chip en globals.css */
        card: 'var(--mp-radius-card)',
        chip: 'var(--mp-radius-chip)',
        'card-lg': '24px',
        'mp-card': 'var(--mp-radius-card)',
        'mp-chip': 'var(--mp-radius-chip)',
      },
      boxShadow: {
        mp: 'var(--mp-shadow)',
        'mp-md': 'var(--mp-shadow-md)',
        card: 'var(--mp-shadow)',
        'card-hover': 'var(--mp-shadow-md)',
      },
      minHeight: {
        tap: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
