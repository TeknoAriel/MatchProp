import type { FastifyReply } from 'fastify';
import { config } from '../config.js';
import { getAccessExpirySeconds } from './session.js';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const COOKIE_OPTS: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; domain?: string } = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  path: '/',
};
if (config.cookieDomain) COOKIE_OPTS.domain = config.cookieDomain;

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
  const clearOpts = { path: '/' as const, ...(config.cookieDomain && { domain: config.cookieDomain }) };
  reply.clearCookie(ACCESS_COOKIE, clearOpts);
  reply.clearCookie(REFRESH_COOKIE, clearOpts);
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
