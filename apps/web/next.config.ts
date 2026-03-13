import type { NextConfig } from 'next';

// Destino del proxy /api/* (solo server-side).
// En Vercel sin API_SERVER_URL: fallback a API prod conocida para que el login funcione.
const apiServerUrl =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL ? 'https://match-prop-api-1jte.vercel.app' : 'http://127.0.0.1:3001');

const nextConfig: NextConfig = {
  transpilePackages: ['@matchprop/shared'],
  reactStrictMode: true,
  devIndicators: false,
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
