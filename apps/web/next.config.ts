import type { NextConfig } from 'next';

// Destino del proxy /api/* (solo server-side). En dev usar 127.0.0.1 para evitar CORS.
const apiServerUrl =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@matchprop/shared'],
  reactStrictMode: true,
  // Ocultar indicador "1 Issue" en dev (overlay de build/errores)
  devIndicators: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiServerUrl.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
