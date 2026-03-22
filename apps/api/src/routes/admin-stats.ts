import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { LeadStatus, UserRole } from '@prisma/client';

function parseDays(q: Record<string, unknown> | undefined, fallback: number): number {
  const raw = q?.days;
  const n = typeof raw === 'number' ? raw : raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(1, Math.min(365, i));
}

export async function adminStatsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/admin/stats/overview',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rangeStart: { type: 'string' },
              rangeEnd: { type: 'string' },
              usersTotal: { type: 'integer' },
              usersPremiumActive: { type: 'integer' },
              usersByRole: { type: 'object' },
              manualPlanGrantsByPlan: { type: 'object' },
              leadsCreated: { type: 'integer' },
              leadsByStatus: { type: 'object' },
              leadsByActivationReason: { type: 'object' },
              visitsUpcoming: { type: 'integer' },
              visitsScheduledInRange: { type: 'integer' },
              alertsActive: { type: 'integer' },
              matchesInRange: { type: 'integer' },
              analyticsByEvent: { type: 'object' },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const now = new Date();
      const days = parseDays(request.query as Record<string, unknown>, 30);
      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - days);
      const rangeEnd = now;

      const [
        usersTotal,
        usersPremiumActive,
        usersByRole,
        leadsCreated,
        leadsByStatus,
        leadsByActivationReason,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { premiumUntil: { gt: now } } }),
        prisma.user.groupBy({ by: ['role'], _count: { id: true } }).then((rows) => {
          const m: Record<string, number> = {};
          for (const r of rows) m[r.role] = r._count.id;
          return m;
        }),
        prisma.lead.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd } } }),
        prisma.lead
          .groupBy({
            by: ['status'],
            where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
            _count: { id: true },
          })
          .then((rows) => {
            const m: Record<string, number> = {};
            for (const r of rows) m[r.status] = r._count.id;
            return m;
          }),
        prisma.lead
          .groupBy({
            by: ['activationReason'],
            where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
            _count: { id: true },
          })
          .then((rows) => {
            const m: Record<string, number> = {};
            for (const r of rows) m[r.activationReason ?? 'NULL'] = r._count.id;
            return m;
          }),
      ]);

      const [
        manualPlanGrantsByPlan,
        visitsUpcoming,
        visitsScheduledInRange,
        alertsActive,
        matchesInRange,
        analyticsByEvent,
      ] = await Promise.all([
        prisma.subscription
          .groupBy({
            by: ['plan'],
            where: {
              provider: 'MANUAL',
              status: 'ACTIVE',
              createdAt: { gte: rangeStart, lte: rangeEnd },
            },
            _count: { id: true },
          })
          .then((rows) => {
            const m: Record<string, number> = {};
            for (const r of rows) m[r.plan] = r._count.id;
            return m;
          }),
        prisma.visit.count({
          where: { scheduledAt: { gt: now }, status: 'SCHEDULED' },
        }),
        prisma.visit.count({
          where: {
            scheduledAt: { gte: rangeStart, lte: rangeEnd },
            status: 'SCHEDULED',
          },
        }),
        prisma.alertSubscription.count({ where: { isEnabled: true } }),
        prisma.matchEvent.count({
          where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        }),
        prisma.analyticsEvent
          .groupBy({
            by: ['eventName'],
            where: {
              createdAt: { gte: rangeStart, lte: rangeEnd },
              eventName: { in: ['listing_viewed', 'search_saved', 'alert_activated'] },
            },
            _count: { id: true },
          })
          .then((rows) => {
            const m: Record<string, number> = {};
            for (const r of rows) m[r.eventName] = r._count.id;
            return m;
          }),
      ]);

      return {
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        usersTotal,
        usersPremiumActive,
        usersByRole,
        manualPlanGrantsByPlan,
        leadsCreated,
        leadsByStatus,
        leadsByActivationReason,
        visitsUpcoming,
        visitsScheduledInRange,
        alertsActive,
        matchesInRange,
        analyticsByEvent,
      };
    }
  );

  fastify.get(
    '/admin/stats/leads',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365 },
            limit: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
            status: { type: 'string', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    createdAt: { type: 'string' },
                    status: { type: 'string' },
                    activationReason: { type: ['string', 'null'] },
                    userEmail: { type: ['string', 'null'] },
                    userRole: { type: ['string', 'null'] },
                    listingId: { type: 'string' },
                    listingTitle: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const now = new Date();
      const q = request.query as Record<string, unknown>;
      const days = parseDays(q, 30);
      const limitRaw = Number(q.limit ?? 50);
      const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)));

      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - days);

      const statusRaw = typeof q.status === 'string' ? q.status : null;
      const allowedStatuses: LeadStatus[] = ['PENDING', 'ACTIVE', 'CLOSED'];
      const status =
        statusRaw && allowedStatuses.includes(statusRaw as LeadStatus)
          ? (statusRaw as LeadStatus)
          : null;

      const leads = await prisma.lead.findMany({
        where: {
          createdAt: { gte: rangeStart, lte: now },
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          createdAt: true,
          status: true,
          activationReason: true,
          listingId: true,
          listing: { select: { title: true } },
          user: { select: { email: true, role: true } },
        },
      });

      return {
        leads: leads.map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          status: l.status,
          activationReason: l.activationReason ?? null,
          userEmail: l.user?.email ?? null,
          userRole: l.user?.role ?? null,
          listingId: l.listingId,
          listingTitle: l.listing?.title ?? null,
        })),
      };
    }
  );

  fastify.get(
    '/admin/stats/visits',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365 },
            limit: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
            upcoming: { type: 'boolean', default: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              visits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    scheduledAt: { type: 'string' },
                    status: { type: 'string' },
                    leadId: { type: 'string' },
                    userEmail: { type: ['string', 'null'] },
                    listingId: { type: 'string' },
                    listingTitle: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const now = new Date();
      const q = request.query as Record<string, unknown>;
      const days = parseDays(q, 30);
      const limitRaw = Number(q.limit ?? 50);
      const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)));

      const upcomingRaw = q.upcoming;
      const upcoming =
        upcomingRaw === true ||
        upcomingRaw === 'true' ||
        upcomingRaw === 1 ||
        upcomingRaw === '1' ||
        upcomingRaw == null;

      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - days);

      const visits = await prisma.visit.findMany({
        where: {
          scheduledAt: upcoming ? { gt: now } : { gte: rangeStart, lte: now },
          status: 'SCHEDULED',
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          leadId: true,
          lead: {
            select: {
              listingId: true,
              listing: { select: { title: true } },
              user: { select: { email: true } },
            },
          },
        },
      });

      return {
        visits: visits.map((v) => ({
          id: v.id,
          scheduledAt: v.scheduledAt.toISOString(),
          status: v.status,
          leadId: v.leadId,
          userEmail: v.lead.user?.email ?? null,
          listingId: v.lead.listingId,
          listingTitle: v.lead.listing?.title ?? null,
        })),
      };
    }
  );

  fastify.get(
    '/admin/stats/matches',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              matches: {
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
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const q = request.query as Record<string, unknown>;
      const limitRaw = Number(q.limit ?? 20);
      const limit = Math.max(1, Math.min(100, Math.floor(limitRaw)));

      const rows = await prisma.matchEvent.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, listingId: true, matchesCount: true, source: true, createdAt: true },
      });

      return {
        matches: rows.map((r) => ({
          id: r.id,
          listingId: r.listingId,
          matchesCount: r.matchesCount,
          source: r.source,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
  );
}
