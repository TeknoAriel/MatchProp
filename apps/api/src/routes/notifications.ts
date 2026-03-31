import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

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
