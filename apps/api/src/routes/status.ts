import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * GET /status/listings-count — Solo en DEMO_MODE=1, sin auth.
 * Para que /status muestre count numérico. Si DEMO_MODE != 1 → 404.
 */
export async function statusRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/status/listings-count',
    {
      schema: {
        tags: ['Status'],
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              bySource: { type: 'object', additionalProperties: { type: 'integer' } },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      if (process.env.DEMO_MODE !== '1') {
        return reply.status(404).send({ message: 'Solo disponible con DEMO_MODE=1' });
      }

      const total = await prisma.listing.count({ where: { status: 'ACTIVE' } });
      const bySource = await prisma.listing.groupBy({
        by: ['source'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      });
      const bySourceMap: Record<string, number> = {};
      for (const row of bySource) {
        bySourceMap[row.source] = row._count.id;
      }
      return { total, bySource: bySourceMap };
    }
  );
}
