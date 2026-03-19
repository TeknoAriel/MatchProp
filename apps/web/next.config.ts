import type { NextConfig } from 'next';

// URL de la API de producción (hardcoded para evitar problemas con env vars)
const API_PROD_URL = 'https://match-prop-admin-dsvv.vercel.app';

// Destino del proxy /api/* (solo server-side).
const apiServerUrl = process.env.VERCEL
  ? API_PROD_URL
  : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001');

const nextConfig: NextConfig = {
  transpilePackages: ['@matchprop/shared'],
  reactStrictMode: true,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? 'local',
  },
  // Next 15.5: `next lint` está deprecado y falla por opciones removidas.
  // Usamos ESLint vía `pnpm lint` (ESLint CLI) en CI.
  eslint: { ignoreDuringBuilds: true },
  // Polling evita EMFILE (too many open files) en macOS
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { poll: 2000, ignored: /node_modules/ };
    }
    return config;
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiServerUrl.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
