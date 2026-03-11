import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
  consumeChallenge,
} from '../services/webauthn.js';
import { createSession } from '../lib/session.js';
import { setAuthCookies } from '../lib/auth-cookies.js';
import { signAccessToken } from '../lib/auth-helpers.js';
import { logAuthAudit } from '../lib/auth-audit.js';
import { upsertUserAndIdentityForMagicLink } from '../services/magic-link.js';

function getClientMeta(request: { ip?: string; headers?: { 'user-agent'?: string } }) {
  return { ip: request.ip, userAgent: request.headers?.['user-agent'] };
}

export async function webauthnRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/auth/webauthn/register/options',
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
          properties: { email: { type: 'string' } },
        },
        response: { 200: { type: 'object' } },
      },
    },
    async (request) => {
      const body = request.body as { email?: string };
      const { options, challengeStr } = await createRegistrationOptions(body.email);
      return { options, challenge: challengeStr };
    }
  );

  fastify.post(
    '/auth/webauthn/register/verify',
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
          required: ['response', 'challenge'],
          properties: {
            response: { type: 'object' },
            challenge: { type: 'string' },
            email: { type: 'string' },
          },
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
      const body = request.body as {
        response: unknown;
        challenge: string;
        email?: string;
      };
      const record = await consumeChallenge(body.challenge);
      if (!record) {
        throw fastify.httpErrors.unauthorized('Challenge inválido o expirado');
      }
      const cred = await verifyRegistration(
        body.response as Parameters<typeof verifyRegistration>[0],
        body.challenge
      );
      if (!cred) {
        throw fastify.httpErrors.unauthorized('Verificación fallida');
      }
      const email = body.email ?? record.email;
      if (!email) {
        throw fastify.httpErrors.badRequest('Email requerido para registro');
      }
      const user = await upsertUserAndIdentityForMagicLink(email);
      await prisma.passkeyCredential.create({
        data: {
          userId: user.userId,
          credentialId: cred.credentialId,
          publicKey: cred.publicKey,
          counter: cred.counter,
        },
      });
      const meta = getClientMeta(request);
      await logAuthAudit({
        event: 'passkey_registered',
        userId: user.userId,
        email: user.email,
        provider: 'passkey',
        ...meta,
      });
      const { refreshToken } = await createSession({ userId: user.userId, ...meta });
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

  fastify.post(
    '/auth/webauthn/login/options',
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
          properties: { email: { type: 'string' } },
        },
        response: { 200: { type: 'object' } },
      },
    },
    async (request) => {
      const body = request.body as { email?: string };
      const { options, challengeStr } = await createAuthenticationOptions(body.email);
      return { options, challenge: challengeStr };
    }
  );

  fastify.post(
    '/auth/webauthn/login/verify',
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
          required: ['response', 'challenge'],
          properties: {
            response: { type: 'object' },
            challenge: { type: 'string' },
          },
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
      const body = request.body as { response: unknown; challenge: string };
      const record = await consumeChallenge(body.challenge);
      if (!record) {
        throw fastify.httpErrors.unauthorized('Challenge inválido o expirado');
      }
      const user = await verifyAuthentication(
        body.response as Parameters<typeof verifyAuthentication>[0],
        body.challenge
      );
      if (!user) {
        throw fastify.httpErrors.unauthorized('Verificación fallida');
      }
      const meta = getClientMeta(request);
      await logAuthAudit({
        event: 'passkey_login',
        userId: user.userId,
        email: user.email,
        provider: 'passkey',
        ...meta,
      });
      const { refreshToken } = await createSession({ userId: user.userId, ...meta });
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
}
