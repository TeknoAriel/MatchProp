import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { trackEvent } from '../lib/analytics.js';

export async function alertsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/subscriptions',
    {
      schema: {
        tags: ['Alerts'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['type'],
          properties: {
            savedSearchId: { type: 'string' },
            type: { type: 'string', enum: ['NEW_LISTING', 'PRICE_DROP', 'BACK_ON_MARKET'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              savedSearchId: { type: ['string', 'null'] },
              type: { type: 'string' },
              isEnabled: { type: 'boolean' },
              createdAt: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: { message: { type: 'string' }, code: { type: 'string' } },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { savedSearchId?: string; type: string };

      const validTypes = ['NEW_LISTING', 'PRICE_DROP', 'BACK_ON_MARKET'];
      if (!validTypes.includes(body.type)) {
        return reply.status(400).send({ message: 'Tipo inválido', code: 'INVALID_TYPE' });
      }

      let savedSearchId: string | null = null;
      let filtersJson: object | null = null;

      if (body.savedSearchId) {
        const search = await prisma.savedSearch.findFirst({
          where: { id: body.savedSearchId, userId: user.userId },
        });
        if (!search) {
          return reply.status(404).send({ message: 'SavedSearch no encontrado' });
        }
        savedSearchId = search.id;
        filtersJson = search.filtersJson as object;
      } else {
        return reply.status(400).send({
          message: 'savedSearchId requerido',
          code: 'INVALID_REQUEST',
        });
      }

      const typeVal = body.type as 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
      const existing = await prisma.alertSubscription.findFirst({
        where: { userId: user.userId, savedSearchId, type: typeVal },
      });

      if (existing) {
        const updated = await prisma.alertSubscription.update({
          where: { id: existing.id },
          data: { isEnabled: true, filtersJson },
        });
        trackEvent('alert_activated', {
          userId: user.userId,
          payload: { subscriptionId: updated.id, type: typeVal },
        }).catch(() => {});
        return reply.status(201).send({
          id: updated.id,
          savedSearchId: updated.savedSearchId,
          type: updated.type,
          isEnabled: updated.isEnabled,
          createdAt: updated.createdAt.toISOString(),
        });
      }

      const created = await prisma.alertSubscription.create({
        data: {
          userId: user.userId,
          savedSearchId,
          filtersJson,
          type: typeVal,
          isEnabled: true,
        },
      });

      return reply.status(201).send({
        id: created.id,
        savedSearchId: created.savedSearchId,
        type: created.type,
        isEnabled: created.isEnabled,
        createdAt: created.createdAt.toISOString(),
      });
    }
  );

  fastify.get(
    '/subscriptions',
    {
      schema: {
        tags: ['Alerts'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                savedSearchId: { type: ['string', 'null'] },
                savedSearchName: { type: ['string', 'null'] },
                type: { type: 'string' },
                isEnabled: { type: 'boolean' },
                lastRunAt: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const list = await prisma.alertSubscription.findMany({
        where: { userId: user.userId },
        include: { savedSearch: { select: { name: true, queryText: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return list.map((s) => ({
        id: s.id,
        savedSearchId: s.savedSearchId,
        savedSearchName: s.savedSearch?.name ?? null,
        savedSearchQueryText: s.savedSearch?.queryText ?? null,
        type: s.type,
        isEnabled: s.isEnabled,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }));
    }
  );

  fastify.patch(
    '/subscriptions/:id',
    {
      schema: {
        tags: ['Alerts'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: { isEnabled: { type: 'boolean' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              isEnabled: { type: 'boolean' },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = request.body as { isEnabled?: boolean };

      const sub = await prisma.alertSubscription.findFirst({
        where: { id, userId: user.userId },
      });
      if (!sub) return reply.status(404).send({ message: 'Suscripción no encontrada' });

      const updated = await prisma.alertSubscription.update({
        where: { id },
        data: body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {},
      });
      return { id: updated.id, isEnabled: updated.isEnabled };
    }
  );

  fastify.delete(
    '/subscriptions/:id',
    {
      schema: {
        tags: ['Alerts'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          204: { type: 'null' },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const sub = await prisma.alertSubscription.findFirst({
        where: { id, userId: user.userId },
      });
      if (!sub) return reply.status(404).send({ message: 'Suscripción no encontrada' });

      await prisma.alertSubscription.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
