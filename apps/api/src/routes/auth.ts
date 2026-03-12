import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';
import { UserRole } from '@prisma/client';
import { createSession, revokeSessionByRefreshToken, rotateSession } from '../lib/session.js';
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
} from '../lib/auth-cookies.js';
import { signAccessToken } from '../lib/auth-helpers.js';
import { logAuthAudit } from '../lib/auth-audit.js';
import {
  createMagicLinkToken,
  consumeMagicLinkToken,
  upsertUserAndIdentityForMagicLink,
  normalizeEmail,
} from '../services/magic-link.js';
import { getMailer } from '../services/mailer/index.js';
import { config } from '../config.js';
import { getOAuthAdapter, type OAuthProvider } from '../services/oauth/index.js';
import {
  createOAuthAttempt,
  consumeOAuthAttempt,
  upsertUserAndIdentityFromOAuth,
  generateState,
  generateCodeVerifier,
} from '../services/oauth-flow.js';

function getClientMeta(request: { ip?: string; headers?: { 'user-agent'?: string } }) {
  return {
    ip: request.ip,
    userAgent: request.headers?.['user-agent'],
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/auth/register',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'AGENT'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (existing) {
        throw fastify.httpErrors.conflict('El email ya está registrado');
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          role: UserRole.AGENT,
        },
      });

      const meta = getClientMeta(request);
      const { refreshToken } = await createSession({
        userId: user.id,
        ...meta,
      });
      const accessToken = signAccessToken(fastify, {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, refreshToken);

      return reply.status(201).send({
        token: accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    }
  );

  fastify.post(
    '/auth/login',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (!user) {
        throw fastify.httpErrors.unauthorized('Credenciales inválidas');
      }

      if (!user.passwordHash) {
        throw fastify.httpErrors.unauthorized('Credenciales inválidas');
      }
      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        throw fastify.httpErrors.unauthorized('Credenciales inválidas');
      }

      const meta = getClientMeta(request);
      const { refreshToken } = await createSession({
        userId: user.id,
        ...meta,
      });
      const accessToken = signAccessToken(fastify, {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, refreshToken);

      return {
        token: accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, role: user.role },
      };
    }
  );

  fastify.post(
    '/auth/magic/request',
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: config.authRateLimitWindowMs,
        },
      },
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              devLink: {
                type: 'string',
                description: 'Solo en dev: link para copiar si el mail no llega',
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { email?: string };
      const rawEmail = body?.email;
      if (!rawEmail || typeof rawEmail !== 'string') {
        throw fastify.httpErrors.badRequest('Email requerido');
      }
      const email = normalizeEmail(rawEmail);
      const meta = getClientMeta(request);
      const appUrl = config.appUrl.replace(/\/$/, '');
      // Mostrar devLink en dev, con DEMO_MODE=1 o en Vercel (no hay mail real)
      const isDev =
        process.env.NODE_ENV !== 'production' ||
        process.env.DEMO_MODE === '1' ||
        process.env.VERCEL === '1';

      let token: string;
      try {
        token = await createMagicLinkToken(email, meta.ip, meta.userAgent);
      } catch (err) {
        request.log.warn({ err }, 'Magic link token create failed, retrying once');
        await new Promise((r) => setTimeout(r, 500));
        try {
          token = await createMagicLinkToken(email, meta.ip, meta.userAgent);
        } catch (err2) {
          request.log.error({ err: err2, email }, 'Magic link request failed');
          return reply.status(200).send({
            message: 'Si el email existe, recibirás un link para iniciar sesión.',
          });
        }
      }

      const link = `${appUrl}/auth/magic/callback?token=${encodeURIComponent(token)}`;
      const mailer = getMailer();
      mailer.sendMagicLink(email, link).catch((err) => request.log.warn({ err }, 'Mailer send failed'));
      logAuthAudit({ event: 'magic_requested', email, ...meta }).catch((err) =>
        request.log.warn({ err }, 'Auth audit failed')
      );

      return {
        message: 'Si el email existe, recibirás un link para iniciar sesión.',
        ...(isDev && { devLink: link }),
      };
    }
  );

  fastify.get(
    '/auth/magic/callback',
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: config.authRateLimitWindowMs,
        },
      },
      schema: {
        tags: ['Auth'],
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const token = (request.query as { token?: string }).token;
      const meta = getClientMeta(request);

      const consumed = await consumeMagicLinkToken(token ?? '');
      if (!consumed) {
        return reply.redirect(302, `${config.appUrl}/login?error=invalid_token`);
      }

      const user = await upsertUserAndIdentityForMagicLink(consumed.email);
      await logAuthAudit({
        event: 'magic_verified',
        userId: user.userId,
        email: user.email,
        provider: 'magic_link',
        ...meta,
      });

      const { refreshToken } = await createSession({
        userId: user.userId,
        ...meta,
      });
      const accessToken = signAccessToken(fastify, {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, refreshToken);

      return reply.redirect(302, config.appUrl);
    }
  );

  fastify.post(
    '/auth/magic/verify',
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: config.authRateLimitWindowMs,
        },
      },
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              refreshToken: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { token?: string };
      const token = body?.token ?? '';
      const meta = getClientMeta(request);

      const consumed = await consumeMagicLinkToken(token);
      if (!consumed) {
        throw fastify.httpErrors.unauthorized('Token inválido o expirado');
      }

      const user = await upsertUserAndIdentityForMagicLink(consumed.email);
      await logAuthAudit({
        event: 'magic_verified',
        userId: user.userId,
        email: user.email,
        provider: 'magic_link',
        ...meta,
      });

      const { refreshToken } = await createSession({
        userId: user.userId,
        ...meta,
      });
      const accessToken = signAccessToken(fastify, {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, refreshToken);

      return {
        token: accessToken,
        refreshToken,
        user: { id: user.userId, email: user.email, role: user.role },
      };
    }
  );

  fastify.get(
    '/auth/oauth/:provider',
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: config.authRateLimitWindowMs,
        },
      },
      schema: {
        tags: ['Auth'],
        params: {
          type: 'object',
          properties: { provider: { type: 'string', enum: ['google', 'apple', 'facebook'] } },
        },
      },
    },
    async (request, reply) => {
      const { provider } = request.params as { provider: string };
      const adapter = getOAuthAdapter(provider as OAuthProvider);
      if (!adapter) {
        return reply.redirect(302, config.oauthFailureRedirect);
      }
      const meta = getClientMeta(request);
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const callbackBase = config.oauthCallbackBase.replace(/\/$/, '');
      const redirectUri = `${callbackBase}/auth/oauth/${provider}/callback`;
      await createOAuthAttempt({
        state,
        provider,
        redirectUri,
        codeVerifier,
        ...meta,
      });
      const authUrl = adapter.getAuthorizationUrl({
        state,
        redirectUri,
        codeVerifier,
      });
      return reply.redirect(302, authUrl);
    }
  );

  fastify.get(
    '/auth/oauth/:provider/callback',
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: config.authRateLimitWindowMs,
        },
      },
      schema: {
        tags: ['Auth'],
        params: {
          type: 'object',
          properties: { provider: { type: 'string', enum: ['google', 'apple', 'facebook'] } },
        },
        querystring: {
          type: 'object',
          properties: { code: { type: 'string' }, state: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { provider } = request.params as { provider: string };
      const query = request.query as { code?: string; state?: string };
      const { code, state } = query;
      if (!code || !state) {
        return reply.redirect(302, config.oauthFailureRedirect);
      }
      const attempt = await consumeOAuthAttempt(state);
      if (!attempt || attempt.provider !== provider) {
        return reply.redirect(302, config.oauthFailureRedirect);
      }
      const adapter = getOAuthAdapter(provider as OAuthProvider);
      if (!adapter) {
        return reply.redirect(302, config.oauthFailureRedirect);
      }
      const callbackBase = config.oauthCallbackBase.replace(/\/$/, '');
      const redirectUri = `${callbackBase}/auth/oauth/${provider}/callback`;
      let profile;
      try {
        profile = await adapter.exchangeCodeForProfile(
          code,
          redirectUri,
          attempt.codeVerifier ?? undefined
        );
      } catch (err) {
        request.log.warn({ err }, 'OAuth token exchange failed');
        return reply.redirect(302, config.oauthFailureRedirect);
      }
      const user = await upsertUserAndIdentityFromOAuth(
        provider as 'google' | 'apple' | 'facebook',
        profile
      );
      const meta = getClientMeta(request);
      await logAuthAudit({
        event: 'oauth_login',
        userId: user.userId,
        email: user.email,
        provider,
        ...meta,
      });
      const { refreshToken } = await createSession({ userId: user.userId, ...meta });
      const accessToken = signAccessToken(fastify, {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, refreshToken);
      return reply.redirect(302, config.oauthSuccessRedirect);
    }
  );

  fastify.post(
    '/auth/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      const refreshToken = getRefreshTokenFromRequest({
        cookies: request.cookies,
        body: request.body as Record<string, unknown> | undefined,
      });
      if (refreshToken) {
        await revokeSessionByRefreshToken(refreshToken);
        const user = request.user as { userId?: string };
        await logAuthAudit({
          event: 'logout',
          userId: user?.userId,
          ...getClientMeta(request),
        });
      }
      clearAuthCookies(reply);
      return { ok: true };
    }
  );

  fastify.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          properties: { refresh_token: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const refreshToken = getRefreshTokenFromRequest({
        cookies: request.cookies,
        body: request.body as Record<string, unknown> | undefined,
      });
      if (!refreshToken) {
        throw fastify.httpErrors.unauthorized('Refresh token required');
      }
      const meta = getClientMeta(request);
      const result = await rotateSession(refreshToken, meta.userAgent, meta.ip);
      if (!result) {
        clearAuthCookies(reply);
        throw fastify.httpErrors.unauthorized('Invalid or expired refresh token');
      }
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: result.userId },
      });
      const accessToken = signAccessToken(fastify, {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      setAuthCookies(reply, accessToken, result.result.refreshToken);
      await logAuthAudit({
        event: 'refresh_rotated',
        userId: user.id,
        ...meta,
      });
      return {
        token: accessToken,
        refreshToken: result.result.refreshToken,
        user: { id: user.id, email: user.email, role: user.role },
      };
    }
  );

  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              premiumUntil: { type: 'string', nullable: true },
              orgMemberships: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    orgId: { type: 'string' },
                    orgName: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string; email: string; role: UserRole };
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { premiumUntil: true },
      });
      const memberships = await prisma.orgMember.findMany({
        where: { userId: user.userId },
        include: { org: true },
      });
      return {
        id: user.userId,
        email: user.email,
        role: user.role,
        premiumUntil: dbUser?.premiumUntil?.toISOString() ?? null,
        orgMemberships: memberships.map((m) => ({
          orgId: m.orgId,
          orgName: m.org.name,
          role: m.role,
        })),
      };
    }
  );

  fastify.get(
    '/auth/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              premiumUntil: { type: 'string', nullable: true },
              orgMemberships: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    orgId: { type: 'string' },
                    orgName: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string; email: string; role: UserRole };
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { premiumUntil: true },
      });
      const memberships = await prisma.orgMember.findMany({
        where: { userId: user.userId },
        include: { org: true },
      });
      return {
        id: user.userId,
        email: user.email,
        role: user.role,
        premiumUntil: dbUser?.premiumUntil?.toISOString() ?? null,
        orgMemberships: memberships.map((m) => ({
          orgId: m.orgId,
          orgName: m.org.name,
          role: m.role,
        })),
      };
    }
  );

  fastify.get(
    '/auth/identities',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                provider: { type: 'string' },
                providerUserId: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                createdAt: { type: 'string' },
                lastUsedAt: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const identities = await prisma.userIdentity.findMany({
        where: { userId: user.userId },
      });
      return identities.map((i) => ({
        provider: i.provider,
        providerUserId: i.providerUserId,
        email: i.email,
        emailVerified: i.emailVerified,
        createdAt: i.createdAt.toISOString(),
        lastUsedAt: i.updatedAt.toISOString(),
      }));
    }
  );

  fastify.post(
    '/auth/identities/unlink',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['provider', 'providerUserId'],
          properties: {
            provider: { type: 'string', enum: ['magic_link', 'google', 'apple', 'facebook'] },
            providerUserId: { type: 'string' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const body = request.body as { provider: string; providerUserId: string };

      const identity = await prisma.userIdentity.findFirst({
        where: {
          userId: user.userId,
          provider: body.provider as 'magic_link' | 'google' | 'apple' | 'facebook',
          providerUserId: body.providerUserId,
        },
      });
      if (!identity) {
        throw fastify.httpErrors.notFound('Identidad no encontrada');
      }

      const [identitiesCount, passkeysCount] = await Promise.all([
        prisma.userIdentity.count({ where: { userId: user.userId } }),
        prisma.passkeyCredential.count({ where: { userId: user.userId } }),
      ]);
      if (identitiesCount <= 1 && passkeysCount === 0) {
        throw fastify.httpErrors.badRequest(
          'No podés desvincular el último método de login. Agregá un passkey u otro proveedor primero.'
        );
      }

      await prisma.userIdentity.delete({ where: { id: identity.id } });
      await logAuthAudit({
        event: 'identity_unlinked',
        userId: user.userId,
        provider: body.provider,
        ...getClientMeta(request),
      });
      return { ok: true };
    }
  );
}
