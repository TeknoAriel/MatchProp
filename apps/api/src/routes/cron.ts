import { FastifyInstance } from 'fastify';
import { runIngest } from '../services/ingest/index.js';
import { prisma } from '../lib/prisma.js';
import { isProductionRuntime } from '../lib/error-handler.js';

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function cronRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/cron/ingest',
    {
      schema: {
        tags: ['Cron'],
        headers: {
          type: 'object',
          properties: {
            authorization: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              source: { type: 'string' },
              inserted: { type: 'number' },
              nextCursor: { type: 'string', nullable: true },
              duration: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = request.headers.authorization;
      const token = auth?.replace('Bearer ', '');

      if (!CRON_SECRET || token !== CRON_SECRET) {
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      const start = Date.now();

      try {
        const result = await runIngest({
          source: 'KITEPROP_EXTERNALSITE',
          limit: 500,
        });

        const duration = Date.now() - start;

        await prisma.outboxEvent.create({
          data: {
            type: 'CRON_INGEST_COMPLETED',
            payload: {
              source: 'KITEPROP_EXTERNALSITE',
              inserted: result.inserted,
              nextCursor: result.nextCursor,
              duration,
              timestamp: new Date().toISOString(),
            },
          },
        });

        return {
          ok: true,
          source: 'KITEPROP_EXTERNALSITE',
          inserted: result.inserted,
          nextCursor: result.nextCursor,
          duration,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        request.log.error({ err: error }, 'Cron ingest failed');

        const body: { ok: false; error?: string; duration: number } = {
          ok: false,
          duration: Date.now() - start,
        };
        if (!isProductionRuntime()) {
          body.error = msg;
        }
        return reply.status(500).send(body);
      }
    }
  );

  fastify.get(
    '/cron/status',
    {
      schema: {
        tags: ['Cron'],
        response: {
          200: {
            type: 'object',
            properties: {
              lastRun: { type: 'string', nullable: true },
              totalListings: { type: 'number' },
              bySource: { type: 'object' },
            },
          },
        },
      },
    },
    async () => {
      const lastEvent = await prisma.outboxEvent.findFirst({
        where: { type: 'CRON_INGEST_COMPLETED' },
        orderBy: { createdAt: 'desc' },
      });

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

      return {
        lastRun: lastEvent?.createdAt?.toISOString() ?? null,
        totalListings: total,
        bySource: bySourceMap,
      };
    }
  );
}
