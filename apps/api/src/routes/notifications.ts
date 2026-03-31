import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  /** Clave pública VAPID para el navegador (sin auth). */
  fastify.get(
    '/notifications/push-config',
    {
      schema: {
        tags: ['Notifications'],
        response: {
          200: {
            type: 'object',
            properties: { publicKey: { type: ['string', 'null'] } },
          },
        },
      },
    },
    async () => ({
      publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? null,
    })
  );

  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/notifications/subscribe',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: { type: 'string' },
            keys: {
              type: 'object',
              required: ['p256dh', 'auth'],
              properties: { p256dh: { type: 'string' }, auth: { type: 'string' } },
            },
          },
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
    },
    async (request) => {
      const userId = (request.user as { userId: string }).userId;
      const body = request.body as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const endpoint = body.endpoint?.trim();
      const p256dh = body.keys?.p256dh?.trim();
      const auth = body.keys?.auth?.trim();
      if (!endpoint || !p256dh || !auth) {
        throw fastify.httpErrors.badRequest('Suscripción push inválida');
      }

      await prisma.webPushSubscription.upsert({
        where: { endpoint },
        create: { userId, endpoint, p256dh, auth },
        update: { userId, p256dh, auth },
      });
      return { ok: true };
    }
  );

  fastify.post(
    '/notifications/unsubscribe',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['endpoint'],
          properties: { endpoint: { type: 'string' } },
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
    },
    async (request) => {
      const userId = (request.user as { userId: string }).userId;
      const { endpoint } = request.body as { endpoint: string };
      await prisma.webPushSubscription.deleteMany({
        where: { userId, endpoint: endpoint.trim() },
      });
      return { ok: true };
    }
  );

  fastify.get(
    '/me/notifications/unread-count',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { count: { type: 'number' } },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const count = await prisma.notification.count({
        where: { userId: user.userId, readAt: null },
      });
      return { count };
    }
  );

  fastify.post(
    '/me/notifications/read-all',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, updated: { type: 'number' } },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const result = await prisma.notification.updateMany({
        where: { userId: user.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true, updated: result.count };
    }
  );

  fastify.get(
    '/me/notifications',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { unreadOnly: { type: 'boolean' } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                payload: { type: 'object' },
                readAt: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const q = request.query as { unreadOnly?: boolean };
      const notifications = await prisma.notification.findMany({
        where: {
          userId: user.userId,
          ...(q.unreadOnly === true ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return notifications.map((n) => ({
        id: n.id,
        type: n.type,
        payload: n.payload,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }));
    }
  );

  fastify.patch(
    '/me/notifications/:id/read',
    {
      schema: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const updated = await prisma.notification.updateMany({
        where: { id, userId: user.userId },
        data: { readAt: new Date() },
      });
      if (updated.count === 0) throw fastify.httpErrors.notFound('Notificación no encontrada');
      return { ok: true };
    }
  );
}
