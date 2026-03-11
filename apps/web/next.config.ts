import type { NextConfig } from 'next';

// Destino del proxy /api/* (solo server-side). En dev usar 127.0.0.1 para evitar CORS.
const apiServerUrl =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@matchprop/shared'],
  reactStrictMode: true,
  devIndicators: false,
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
