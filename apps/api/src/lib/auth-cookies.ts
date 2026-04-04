import type { FastifyReply } from 'fastify';
import { config } from '../config.js';
import { getAccessExpirySeconds } from './session.js';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

// En desarrollo/test nunca forzar Secure aunque COOKIE_SECURE venga de .env copiado de Vercel:
// si no, el navegador no guarda cookies en http://localhost y demo/magic parecen "rotos".
const secureCookie = config.cookieSecure && process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    ...COOKIE_OPTS,
    maxAge: getAccessExpirySeconds(),
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...COOKIE_OPTS,
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export function getRefreshTokenFromRequest(request: {
  cookies?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}): string | undefined {
  const fromCookie = request.cookies?.['refresh_token'];
  if (typeof fromCookie === 'string') return fromCookie;
  const fromBody = request.body?.['refresh_token'];
  return typeof fromBody === 'string' ? fromBody : undefined;
}
