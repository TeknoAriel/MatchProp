import type { FastifyRequest } from 'fastify';
import { config } from '../config.js';

export type MagicAppUrlConfig = { appUrl: string; corsOrigins: string[] };

/**
 * Base URL de la web para armar el magic link. Prioriza `Origin` cuando es de confianza
 * (CORS o localhost en dev) para no mezclar APP_URL de producción con DB local.
 */
export function resolveMagicAppBaseUrl(
  request: Pick<FastifyRequest, 'headers'>,
  cfg: MagicAppUrlConfig = { appUrl: config.appUrl, corsOrigins: config.corsOrigins }
): string {
  const fallback = (cfg.appUrl || 'http://localhost:3000').replace(/\/$/, '');
  const origin = request.headers.origin;
  if (!origin) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback;
  const base = parsed.origin.replace(/\/$/, '');
  const inCors = cfg.corsOrigins.some((co) => {
    const c = co.replace(/\/$/, '');
    return base === c || origin.startsWith(`${c}/`);
  });
  const isLocalDev =
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
  if (inCors || isLocalDev) return base;
  return fallback;
}
