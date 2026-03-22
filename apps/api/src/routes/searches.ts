import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { executeFeed } from '../lib/feed-engine.js';
import { createSavedSearchRequestSchema, normalizeFilters } from '../schemas/search.js';
import { trackEvent } from '../lib/analytics.js';

const FEED_LIMIT_DEFAULT = 20;
const FEED_LIMIT_MAX = 50;
const VALID_OPERATIONS = ['SALE', 'RENT'] as const;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;

function parseIntParam(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Math.floor(Number(val));
  return Number.isNaN(n) ? undefined : n;
}

function toSavedSearchDTO(row: {
  id: string;
  name: string;
  queryText: string | null;
  filtersJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const filters = normalizeFilters(row.filtersJson);
  return {
    id: row.id,
    name: row.name,
    queryText: row.queryText,
    filters,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function searchesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/searches',
    {
      schema: {
        tags: ['Searches'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['filters'],
          properties: {
            name: { type: 'string', maxLength: 100 },
            text: { type: 'string', maxLength: 500 },
            filters: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              queryText: { type: ['string', 'null'] },
              filters: { type: 'object' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { name?: string; text?: string; filters?: unknown };

      const parsed = createSavedSearchRequestSchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: parsed.error.errors[0]?.message ?? 'Invalid request',
          code: 'INVALID_REQUEST',
        });
      }
      const { name, text, filters } = parsed.data;

      const filtersNorm = normalizeFilters(filters);
      const count = await prisma.savedSearch.count({
        where: { userId: user.userId },
      });
      const defaultName = name ?? `Búsqueda ${count + 1}`;

      const created = await prisma.savedSearch.create({
        data: {
          userId: user.userId,
          name: defaultName,
          queryText: text ?? null,
          filtersJson: filtersNorm as object,
          updatedAt: new Date(),
        },
      });

      await prisma.user.update({
        where: { id: user.userId },
        data: { activeSearchId: created.id },
      });

      trackEvent('search_saved', {
        userId: user.userId,
        payload: { searchId: created.id },
      }).catch(() => {});

      return reply.status(201).send(toSavedSearchDTO(created));
    }
  );

  fastify.get(
    '/searches',
    {
      schema: {
        tags: ['Searches'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                queryText: { type: ['string', 'null'] },
                filters: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const list = await prisma.savedSearch.findMany({
        where: { userId: user.userId },
        orderBy: { updatedAt: 'desc' },
      });
      return list.map(toSavedSearchDTO);
    }
  );

  fastify.get(
    '/searches/:id',
    {
      schema: {
        tags: ['Searches'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              queryText: { type: ['string', 'null'] },
              filters: { type: 'object' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const row = await prisma.savedSearch.findFirst({
        where: { id, userId: user.userId },
      });
      if (!row) return reply.status(404).send({ message: 'SavedSearch no encontrado' }) as never;

      return toSavedSearchDTO(row);
    }
  );

  fastify.get(
    '/searches/:id/results',
    {
      schema: {
        tags: ['Searches'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: FEED_LIMIT_DEFAULT },
            cursor: { type: 'string' },
            includeTotal: { type: 'integer', default: 0 },
            propertyTypes: { type: 'string' },
            operationType: { type: 'string', enum: ['SALE', 'RENT'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { type: 'object' } },
              total: { type: ['integer', 'null'] },
              limit: { type: 'integer' },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const q = request.query as {
        limit?: number;
        cursor?: string;
        includeTotal?: number;
        propertyTypes?: string;
        operationType?: string;
      };

      const row = await prisma.savedSearch.findFirst({
        where: { id, userId: user.userId },
      });
      if (!row) return reply.status(404).send({ message: 'SavedSearch no encontrado' }) as never;

      const limit = Math.min(
        FEED_LIMIT_MAX,
        Math.max(1, parseIntParam(q.limit) ?? FEED_LIMIT_DEFAULT)
      );
      const includeTotal = parseIntParam(q.includeTotal) === 1;

      const filters = normalizeFilters(row.filtersJson) as Record<string, unknown>;
      if (
        typeof q.propertyTypes === 'string' &&
        VALID_PROPERTY_TYPES.includes(q.propertyTypes as (typeof VALID_PROPERTY_TYPES)[number])
      ) {
        filters.propertyType = [q.propertyTypes];
      }
      if (
        typeof q.operationType === 'string' &&
        VALID_OPERATIONS.includes(q.operationType as (typeof VALID_OPERATIONS)[number])
      ) {
        filters.operationType = q.operationType;
      }

      try {
        const result = await executeFeed({
          userId: user.userId,
          limit,
          cursor: q.cursor ?? null,
          includeTotal,
          filters,
        });

        if (result.error === 'INVALID_CURSOR') {
          return reply.status(400).send({
            message: 'Cursor inválido',
            code: 'INVALID_CURSOR',
          });
        }

        return result;
      } catch (err) {
        request.log.error(err, 'Searches results error');
        return {
          items: [],
          total: 0,
          limit,
          nextCursor: null,
        };
      }
    }
  );

  fastify.put(
    '/searches/:id',
    {
      schema: {
        tags: ['Searches'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 100 },
            text: { type: 'string', maxLength: 500 },
            filters: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              queryText: { type: ['string', 'null'] },
              filters: { type: 'object' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
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
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; text?: string; filters?: unknown };

      const row = await prisma.savedSearch.findFirst({
        where: { id, userId: user.userId },
      });
      if (!row) return reply.status(404).send({ message: 'SavedSearch no encontrado' }) as never;

      const updates: { name?: string; queryText?: string | null; filtersJson?: object } = {};
      if (body.name !== undefined) updates.name = body.name.slice(0, 100);
      if (body.text !== undefined) updates.queryText = body.text?.trim() || null;
      if (body.filters !== undefined) {
        updates.filtersJson = normalizeFilters(body.filters) as object;
      }

      const updated = await prisma.savedSearch.update({
        where: { id },
        data: { ...updates, updatedAt: new Date() },
      });
      return toSavedSearchDTO(updated);
    }
  );

  fastify.delete(
    '/searches/:id',
    {
      schema: {
        tags: ['Searches'],
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

      const row = await prisma.savedSearch.findFirst({
        where: { id, userId: user.userId },
      });
      if (!row) return reply.status(404).send({ message: 'SavedSearch no encontrado' }) as never;

      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { activeSearchId: true },
      });
      if (u?.activeSearchId === id) {
        await prisma.user.update({
          where: { id: user.userId },
          data: { activeSearchId: null },
        });
      }
      await prisma.savedSearch.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
