/**
 * API Universal — Endpoints REST públicos para integradores externos.
 * Autenticación: header X-API-Key. Variable de entorno API_UNIVERSAL_KEY.
 * Similar a Kiteprop: feed básico y listings.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { executeFeed } from '../lib/feed-engine.js';

const VALID_KEYS = (process.env.API_UNIVERSAL_KEY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function apiKeyAuth(
  request: FastifyRequest<{ Headers: { 'x-api-key'?: string } }>,
  reply: FastifyReply,
  done: (err?: Error) => void
) {
  if (VALID_KEYS.length === 0) {
    reply.status(503).send({ error: 'API Universal no configurada. Definir API_UNIVERSAL_KEY.' });
    return done();
  }
  const key = request.headers['x-api-key'];
  if (!key || !VALID_KEYS.includes(key)) {
    reply.status(401).send({ error: 'Invalid or missing X-API-Key' });
    return done();
  }
  done();
}

export async function apiUniversalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', apiKeyAuth);

  fastify.get(
    '/universal/feed',
    {
      schema: {
        tags: ['API Universal'],
        description: 'Feed de listings (sin preferencias de usuario). Requiere X-API-Key.',
        querystring: {
          limit: { type: 'number', default: 20 },
          cursor: { type: 'string' },
          operation: { type: 'string', enum: ['SALE', 'RENT'] },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array' },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        limit?: number;
        cursor?: string;
        operation?: string;
        minPrice?: number;
        maxPrice?: number;
      };
      const limit = Math.min(Math.max(1, Number(q.limit) || 20), 100);
      const filters: Record<string, unknown> = {};
      if (q.operation) filters.operationType = q.operation;
      if (q.minPrice != null) filters.priceMin = q.minPrice;
      if (q.maxPrice != null) filters.priceMax = q.maxPrice;

      const result = await executeFeed({
        filters: filters as Parameters<typeof executeFeed>[0]['filters'],
        limit,
        cursor: q.cursor ?? null,
        userId: 'api-universal',
      });
      if (result && 'error' in result) {
        return reply.status(400).send({ error: result.error });
      }
      const feedResult = result as { items: unknown[]; nextCursor: string | null };
      return reply.send({
        items: feedResult.items,
        nextCursor: feedResult.nextCursor,
      });
    }
  );

  fastify.get(
    '/universal/listings',
    {
      schema: {
        tags: ['API Universal'],
        description: 'Lista de listings activos. Requiere X-API-Key.',
        querystring: {
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
          source: { type: 'string' },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array' },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as { limit?: number; offset?: number; source?: string };
      const limit = Math.min(Math.max(1, Number(q.limit) || 20), 100);
      const offset = Math.max(0, Number(q.offset) || 0);
      const where: Record<string, unknown> = { status: 'ACTIVE' };
      if (q.source) where.source = q.source;

      const [items, total] = await Promise.all([
        prisma.listing.findMany({
          where,
          select: {
            id: true,
            title: true,
            price: true,
            currency: true,
            bedrooms: true,
            bathrooms: true,
            areaTotal: true,
            locationText: true,
            heroImageUrl: true,
            source: true,
            operationType: true,
          },
          orderBy: { lastSeenAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.listing.count({ where }),
      ]);
      return reply.send({ items, total });
    }
  );

  fastify.get(
    '/universal/health',
    {
      schema: {
        tags: ['API Universal'],
        description: 'Healthcheck para integradores. Requiere X-API-Key.',
        response: { 200: { type: 'object', properties: { status: { type: 'string' } } } },
      },
    },
    async (_, reply) => {
      return reply.send({ status: 'ok' });
    }
  );
}
