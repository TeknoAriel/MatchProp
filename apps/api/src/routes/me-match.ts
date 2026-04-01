import type { FastifyInstance } from 'fastify';
import { getAggregatedMatchFeed } from '../lib/match-aggregate-feed.js';

const listingCardLoose = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    title: { type: ['string', 'null'] },
    price: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
  },
};

/**
 * Mis match agregado: GET /me/match/feed (SPEC — multi-búsqueda, orden like > favorito > resto).
 */
export async function meMatchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/me/match/feed',
    {
      schema: {
        tags: ['Me'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 60 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: listingCardLoose },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const q = request.query as { limit?: number };
      const limit = q.limit ?? 60;
      const items = await getAggregatedMatchFeed(user.userId, { maxListings: limit });
      return { items };
    }
  );
}
