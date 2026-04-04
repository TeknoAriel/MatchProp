/**
 * Panel admin: registros agregados, listado de suscripciones y pagos.
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  UserRole,
  type SubscriptionStatus,
  type PaymentStatus,
  type PaymentProvider,
} from '@prisma/client';
import { PLANS } from '../lib/plans.js';

const ACTIVE_SUB: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

function clampInt(n: unknown, min: number, max: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  const i = Math.floor(x);
  return Math.max(min, Math.min(max, i));
}

export async function adminBillingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/admin/registrations/summary',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              totalUsers: { type: 'number' },
              signupsLast7Days: { type: 'number' },
              bySignupMethod: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    signupMethod: { type: ['string', 'null'] },
                    count: { type: 'number' },
                  },
                },
              },
              plansCatalog: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    priceMonthlyUsd: { type: 'number' },
                    priceYearlyUsd: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [totalUsers, signupsLast7Days, byMethodRaw] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.groupBy({
          by: ['signupMethod'],
          _count: { id: true },
        }),
      ]);

      const bySignupMethod = byMethodRaw.map((row) => ({
        signupMethod: row.signupMethod ?? null,
        count: row._count.id,
      }));

      const plansCatalog = Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthlyUsd: p.priceMonthly / 100,
        priceYearlyUsd: p.priceYearly / 100,
      }));

      return {
        totalUsers,
        signupsLast7Days,
        bySignupMethod,
        plansCatalog,
      };
    }
  );

  fastify.get(
    '/admin/subscriptions',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            plan: { type: 'string' },
            userId: { type: 'string' },
            limit: { type: 'integer', default: 30 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              subscriptions: { type: 'array' },
              total: { type: 'number' },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const q = request.query as {
        status?: string;
        plan?: string;
        userId?: string;
        limit?: number;
        offset?: number;
      };
      const limit = clampInt(q.limit ?? 30, 1, 100);
      const offset = clampInt(q.offset ?? 0, 0, 100000);

      const where: Parameters<typeof prisma.subscription.findMany>[0]['where'] = {};
      if (q.userId?.trim()) where.userId = q.userId.trim();
      if (q.status?.trim()) {
        const st = q.status.trim() as SubscriptionStatus;
        where.status = st;
      }
      if (q.plan?.trim()) {
        const pl = q.plan.trim() as keyof typeof PLANS;
        if (PLANS[pl]) where.plan = pl;
      }

      const [rows, total] = await Promise.all([
        prisma.subscription.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            user: { select: { id: true, email: true, role: true, signupMethod: true } },
          },
        }),
        prisma.subscription.count({ where }),
      ]);

      return {
        subscriptions: rows.map((s) => ({
          id: s.id,
          userId: s.userId,
          userEmail: s.user.email,
          userRole: s.user.role,
          userSignupMethod: s.user.signupMethod ?? null,
          plan: s.plan,
          status: s.status,
          provider: s.provider,
          currentPeriodStart: s.currentPeriodStart.toISOString(),
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          cancelledAt: s.cancelledAt?.toISOString() ?? null,
          providerSubscriptionId: s.providerSubscriptionId,
          createdAt: s.createdAt.toISOString(),
        })),
        total,
      };
    }
  );

  fastify.get(
    '/admin/payments',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            provider: { type: 'string' },
            userId: { type: 'string' },
            limit: { type: 'integer', default: 30 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              payments: { type: 'array' },
              total: { type: 'number' },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const q = request.query as {
        status?: string;
        provider?: string;
        userId?: string;
        limit?: number;
        offset?: number;
      };
      const limit = clampInt(q.limit ?? 30, 1, 100);
      const offset = clampInt(q.offset ?? 0, 0, 100000);

      const where: Parameters<typeof prisma.payment.findMany>[0]['where'] = {};
      if (q.userId?.trim()) where.userId = q.userId.trim();
      if (q.status?.trim()) where.status = q.status.trim() as PaymentStatus;
      if (q.provider?.trim()) where.provider = q.provider.trim() as PaymentProvider;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            user: { select: { email: true } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return {
        payments: payments.map((p) => ({
          id: p.id,
          userId: p.userId,
          userEmail: p.user.email,
          subscriptionId: p.subscriptionId,
          amountUsd: p.amount / 100,
          currency: p.currency,
          status: p.status,
          provider: p.provider,
          description: p.description,
          paidAt: p.paidAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        total,
      };
    }
  );

  /** Suscripciones con estado “de pago” activo (útil para soporte). */
  fastify.get(
    '/admin/subscriptions/active-summary',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              byPlan: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    plan: { type: 'string' },
                    count: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async () => {
      const byPlan = await prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: { in: ACTIVE_SUB } },
        _count: { id: true },
      });
      const count = byPlan.reduce((acc, r) => acc + r._count.id, 0);
      return {
        count,
        byPlan: byPlan.map((r) => ({ plan: r.plan, count: r._count.id })),
      };
    }
  );
}
