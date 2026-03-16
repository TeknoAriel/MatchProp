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
import { getMailerForSend } from '../services/mailer/index.js';
import { config, envFlag } from '../config.js';
import {
  isKitepropAdmin,
  KITEPROP_ADMIN_PASSWORD,
} from '../lib/kiteprop-admins.js';
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
      const email = body.email.trim().toLowerCase();

      // Bootstrap admins Kiteprop: si el email es uno de los tres y la contraseña es la conocida,
      // crear o actualizar usuario con rol ADMIN y esa contraseña (para prod sin seed).
      const passwordTrimmed = typeof body.password === 'string' ? body.password.trim() : '';
      if (isKitepropAdmin(email) && passwordTrimmed === KITEPROP_ADMIN_PASSWORD) {
        const adminHash = await bcrypt.hash(KITEPROP_ADMIN_PASSWORD, 10);
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, passwordHash: adminHash, role: UserRole.ADMIN },
          update: { passwordHash: adminHash, role: UserRole.ADMIN },
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
        return {
          token: accessToken,
          refreshToken,
          user: { id: user.id, email: user.email, role: user.role },
        };
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        throw fastify.httpErrors.unauthorized('Credenciales inválidas');
      }

      // Usuario existente sin contraseña (p. ej. creado por magic link): si es admin Kiteprop y la contraseña es la conocida, setear hash y dar acceso.
      if (!user.passwordHash && isKitepropAdmin(email) && passwordTrimmed === KITEPROP_ADMIN_PASSWORD) {
        const adminHash = await bcrypt.hash(KITEPROP_ADMIN_PASSWORD, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: adminHash, role: UserRole.ADMIN },
        });
        const meta = getClientMeta(request);
        const { refreshToken } = await createSession({ userId: user.id, ...meta });
        const accessToken = signAccessToken(fastify, {
          userId: user.id,
          email: user.email,
          role: UserRole.ADMIN,
        });
        setAuthCookies(reply, accessToken, refreshToken);
        return {
          token: accessToken,
          refreshToken,
          user: { id: user.id, email: user.email, role: UserRole.ADMIN },
        };
      }

      if (!user.passwordHash) {
        throw fastify.httpErrors.unauthorized('Credenciales inválidas');
      }
      const pwd = typeof body.password === 'string' ? body.password.trim() : '';
      const valid = pwd && (await bcrypt.compare(pwd, user.passwordHash));
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
      const appUrl = (config.appUrl || 'http://localhost:3000').replace(/\/$/, '');
      const isDev =
        process.env.NODE_ENV !== 'production' || envFlag('DEMO_MODE') || process.env.VERCEL === '1';

      try {
        const body = request.body as { email?: string };
        const rawEmail = body?.email;
        if (!rawEmail || typeof rawEmail !== 'string') {
          throw fastify.httpErrors.badRequest('Email requerido');
        }
        const email = normalizeEmail(rawEmail);
        const meta = getClientMeta(request);

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
              message: 'La base de datos no está disponible. Usá «Entrar con link demo» para acceder.',
              ...(isDev && { devLink: `${appUrl}/login?useDemo=1` }),
            });
          }
        }

        const link = `${appUrl}/auth/magic/callback?token=${encodeURIComponent(token)}`;
        const mailer = await getMailerForSend();
        mailer.sendMagicLink(email, link).catch((err) => request.log.warn({ err }, 'Mailer send failed'));
        logAuthAudit({ event: 'magic_requested', email, ...meta }).catch((err) =>
          request.log.warn({ err }, 'Auth audit failed')
        );

        return {
          message: 'Si el email existe, recibirás un link para iniciar sesión.',
          ...(isDev && { devLink: link }),
        };
      } catch (err) {
        request.log.error({ err }, 'Magic link request error');
        return reply.status(200).send({
          message: 'No se pudo enviar el link. Usá «Entrar con link demo» para acceder.',
          ...(isDev && { devLink: `${appUrl}/login?useDemo=1` }),
        });
      }
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

  const isDevAuth =
    process.env.NODE_ENV !== 'production' || envFlag('DEMO_MODE') || process.env.VERCEL === '1';

  const isStatelessDemo = envFlag('DEMO_MODE') && !process.env.DATABASE_URL;
  fastify.post(
    '/auth/demo',
    {
      config: {
        rateLimit: { max: config.authRateLimitMax, timeWindow: config.authRateLimitWindowMs },
      },
      schema: {
        tags: ['Auth'],
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      if (!isDevAuth) throw fastify.httpErrors.forbidden('Solo en modo demo');
      const meta = getClientMeta(request);
      const DEMO_EMAIL = 'demo@matchprop.com';
      try {
        if (isStatelessDemo) {
          // Demo sin base de datos: generar un usuario y sesión efímera solo con JWT.
          const fakeUserId = 'demo-user';
          const accessToken = signAccessToken(fastify, {
            userId: fakeUserId,
            email: DEMO_EMAIL,
            // Rol por defecto para navegar el producto; no se persiste en DB.
            role: 'AGENT',
          });
          // Usamos un refresh token sintético que no se guarda en DB; los endpoints de refresh
          // simplemente devolverán 401, lo cual es aceptable en este modo demo sin expiraciones largas.
          const demoRefresh = 'demo-refresh-token';
          setAuthCookies(reply, accessToken, demoRefresh);
        } else {
          const user = await upsertUserAndIdentityForMagicLink(DEMO_EMAIL);
          await logAuthAudit({
            event: 'magic_verified',
            userId: user.userId,
            email: user.email,
            provider: 'magic_link',
            ...meta,
          });
          const { refreshToken } = await createSession({ userId: user.userId, ...meta });
          const accessToken = signAccessToken(fastify, {
            userId: user.userId,
            email: user.email,
            role: user.role,
          });
          setAuthCookies(reply, accessToken, refreshToken);
        }
      } catch (err) {
        // Si la base de datos no está disponible u ocurre un error de Prisma,
        // degradar a modo demo sin DB en lugar de devolver 500.
        request.log.warn({ err }, 'auth/demo falling back to stateless demo');
        const fakeUserId = 'demo-user';
        const accessToken = signAccessToken(fastify, {
          userId: fakeUserId,
          email: DEMO_EMAIL,
          role: 'AGENT',
        });
        const demoRefresh = 'demo-refresh-token';
        setAuthCookies(reply, accessToken, demoRefresh);
      }
      return { ok: true };
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
