import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

/** DEV/DEMO only: GET /admin/debug/listings-count */
export async function debugRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/debug/listings-count',
    {
      schema: {
        tags: ['Debug'],
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              bySource: { type: 'object', additionalProperties: { type: 'integer' } },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
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

  fastify.get(
    '/admin/debug/listings/:id/matches',
    {
      schema: {
        tags: ['Debug'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              matchesCount: { type: 'integer' },
              topSearchIds: { type: 'array', items: { type: 'string' } },
              source: { type: 'string', enum: ['ListingMatchCandidate', 'CrmPushOutbox'] },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }
      const { id } = request.params as { id: string };

      const candidates = await prisma.listingMatchCandidate.findMany({
        where: { listingId: id },
        select: { savedSearchId: true },
        orderBy: { createdAt: 'desc' },
      });
      if (candidates.length > 0) {
        const topSearchIds = candidates.slice(0, 10).map((c) => c.savedSearchId);
        return {
          matchesCount: candidates.length,
          topSearchIds,
          source: 'ListingMatchCandidate',
        };
      }

      const last = await prisma.crmPushOutbox.findFirst({
        where: { listingId: id },
        orderBy: { createdAt: 'desc' },
        select: { matchesCount: true, topSearchIds: true },
      });
      return {
        matchesCount: last?.matchesCount ?? 0,
        topSearchIds: (last?.topSearchIds as string[]) ?? [],
        source: 'CrmPushOutbox',
      };
    }
  );

  /** Sprint 11: status CRM push outbox (PENDING/SENT/FAILED, top FAILED, nextAttemptAt). */
  fastify.get(
    '/admin/debug/crm-push',
    {
      schema: {
        tags: ['Debug'],
        response: {
          200: {
            type: 'object',
            properties: {
              counts: {
                type: 'object',
                properties: {
                  PENDING: { type: 'integer' },
                  SENT: { type: 'integer' },
                  FAILED: { type: 'integer' },
                },
              },
              topFailed: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    listingId: { type: 'string' },
                    attempts: { type: 'integer' },
                    nextAttemptAt: { type: ['string', 'null'] },
                    lastError: { type: ['string', 'null'] },
                  },
                },
              },
              nextAttemptAtNearest: { type: ['string', 'null'] },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }

      const [counts, failed, nearest] = await Promise.all([
        prisma.crmPushOutbox.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        prisma.crmPushOutbox.findMany({
          where: { status: 'FAILED' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            listingId: true,
            attempts: true,
            nextAttemptAt: true,
            lastError: true,
          },
        }),
        prisma.crmPushOutbox.findFirst({
          where: { status: 'PENDING', nextAttemptAt: { not: null } },
          orderBy: { nextAttemptAt: 'asc' },
          select: { nextAttemptAt: true },
        }),
      ]);

      const countMap: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0 };
      for (const row of counts) {
        countMap[row.status] = row._count.id;
      }

      return {
        counts: countMap,
        topFailed: failed.map((r) => ({
          id: r.id,
          listingId: r.listingId,
          attempts: r.attempts,
          nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null,
          lastError: r.lastError ? r.lastError.slice(0, 200) : null,
        })),
        nextAttemptAtNearest: nearest?.nextAttemptAt?.toISOString() ?? null,
      };
    }
  );

  /** Sprint 12: listado outbox para UI admin (últimos 50). */
  fastify.get(
    '/admin/debug/crm-push/list',
    {
      schema: {
        tags: ['Debug'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                listingId: { type: 'string' },
                status: { type: 'string' },
                attempts: { type: 'integer' },
                nextAttemptAt: { type: ['string', 'null'] },
                lastError: { type: ['string', 'null'] },
                matchesCount: { type: 'integer' },
                createdAt: { type: 'string' },
              },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }
      const rows = await prisma.crmPushOutbox.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          listingId: true,
          status: true,
          attempts: true,
          nextAttemptAt: true,
          lastError: true,
          matchesCount: true,
          createdAt: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        status: r.status,
        attempts: r.attempts,
        nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null,
        lastError: r.lastError ? r.lastError.slice(0, 300) : null,
        matchesCount: r.matchesCount,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /** Sprint 11: MatchEvent inbox (matches found). */
  fastify.get(
    '/admin/debug/match-events',
    {
      schema: {
        tags: ['Debug'],
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', default: 50 } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                listingId: { type: 'string' },
                matchesCount: { type: 'integer' },
                source: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }
      const qs = request.query as { limit?: number };
      const limit = Math.min(100, Math.max(1, qs?.limit ?? 50));
      const rows = await prisma.matchEvent.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, listingId: true, matchesCount: true, source: true, createdAt: true },
      });
      return rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        matchesCount: r.matchesCount,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /** Admin: listado de visitas agendadas (próximas y recientes). */
  fastify.get(
    '/admin/debug/visits',
    {
      schema: {
        tags: ['Debug'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 50 },
            upcoming: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                leadId: { type: 'string' },
                listingId: { type: 'string' },
                scheduledAt: { type: 'string' },
                status: { type: 'string' },
                userEmail: { type: ['string', 'null'] },
                listingTitle: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
              },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }
      const qs = request.query as { limit?: number; upcoming?: boolean };
      const limit = Math.min(100, Math.max(1, qs?.limit ?? 50));
      const now = new Date();
      const filter = qs?.upcoming === false ? undefined : { scheduledAt: { gte: now } };
      const rows = await prisma.visit.findMany({
        where: filter,
        take: limit,
        orderBy: { scheduledAt: qs?.upcoming === false ? 'desc' : 'asc' },
        include: {
          lead: {
            include: {
              user: { select: { email: true } },
              listing: { select: { id: true, title: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        listingId: r.lead.listingId,
        scheduledAt: r.scheduledAt.toISOString(),
        status: r.status,
        userEmail: r.lead.user?.email ?? null,
        listingTitle: r.lead.listing?.title ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    }
  );

  /** Sprint 12: resend manual de un outbox FAILED (o PENDING). */
  fastify.post(
    '/admin/debug/crm-push/:id/resend',
    {
      schema: {
        tags: ['Debug'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, id: { type: 'string' } },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const allowed = config.demoMode || process.env.NODE_ENV === 'development';
      if (!allowed) {
        return reply.status(403).send({ message: 'Solo en DEMO_MODE o development' });
      }
      const { id } = request.params as { id: string };
      const now = new Date();
      const updated = await prisma.crmPushOutbox.updateMany({
        where: { id },
        data: {
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: now,
          lastError: null,
        },
      });
      if (updated.count === 0) {
        return reply.status(404).send({ message: 'CrmPushOutbox no encontrado' });
      }
      return { ok: true, id };
    }
  );
}
