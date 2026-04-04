import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  UserRole,
  type PaymentProvider,
  type SubscriptionStatus,
  type SignupMethod,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PLANS } from '../lib/plans.js';

const ACTIVE_SUB_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

const ORG_DISCOUNT = 0.2; // 20% dto para AGENT/REALTOR bajo INMOBILIARIA

type AdminAssignBody = {
  email: string;
  plan: keyof typeof PLANS;
  billingCycle: 'monthly' | 'yearly';
  graceDays?: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function clampInt(n: unknown, min: number, max: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  const i = Math.floor(x);
  return Math.max(min, Math.min(max, i));
}

function computePeriodEnd(now: Date, billingCycle: 'monthly' | 'yearly', graceDays: number) {
  const end = new Date(now);
  if (billingCycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  if (graceDays > 0) end.setDate(end.getDate() + graceDays);
  return end;
}

export async function adminUsersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/admin/users/assign-plan',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email', 'plan', 'billingCycle'],
          properties: {
            email: { type: 'string', format: 'email' },
            plan: { type: 'string', enum: ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'] },
            billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
            graceDays: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                  premiumUntil: { type: ['string', 'null'] },
                },
              },
              subscription: { type: 'object' },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const body = request.body as AdminAssignBody;
      const now = new Date();

      const email = normalizeEmail(body.email);
      const plan = body.plan as keyof typeof PLANS;
      const billingCycle = body.billingCycle;
      const graceDays = clampInt(body.graceDays ?? 0, 0, 3650);

      // En caso de que exista por magic link, preservamos su historial.
      let dbUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, role: true, organizationId: true },
      });

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email,
            role: 'BUYER',
            signupMethod: 'ADMIN_GRANT',
          },
        });
      }

      const periodEnd = computePeriodEnd(now, billingCycle, graceDays);

      // Cancelamos suscripciones anteriores activas para mantener consistencia.
      await prisma.subscription.updateMany({
        where: {
          userId: dbUser.id,
          status: { in: ACTIVE_SUB_STATUSES },
        },
        data: { status: 'CANCELLED', cancelledAt: now },
      });

      const subscription = await prisma.subscription.create({
        data: {
          userId: dbUser.id,
          plan: plan as unknown as UserRole,
          status: 'ACTIVE',
          provider: 'MANUAL' as PaymentProvider,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          role: plan as unknown as UserRole,
          premiumUntil: periodEnd,
        },
      });

      // Guardamos un payment para auditoría (no es checkout real).
      const basePrice =
        billingCycle === 'yearly' ? PLANS[plan].priceYearly : PLANS[plan].priceMonthly;
      const hasOrgDiscount = (plan === 'AGENT' || plan === 'REALTOR') && !!dbUser.organizationId;
      const amount = hasOrgDiscount ? Math.round(basePrice * (1 - ORG_DISCOUNT)) : basePrice;
      await prisma.payment.create({
        data: {
          userId: dbUser.id,
          subscriptionId: subscription.id,
          amount,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'MANUAL' as PaymentProvider,
          description: `Admin grant: ${plan} (${billingCycle}) + graceDays=${graceDays}`,
          metadata: { graceDays, billingCycle },
          paidAt: now,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { id: true, email: true, role: true, premiumUntil: true },
      });

      return {
        user: {
          id: user?.id,
          email: user?.email,
          role: user?.role,
          premiumUntil: user?.premiumUntil?.toISOString() ?? null,
        },
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      };
    }
  );

  fastify.get(
    '/admin/users',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string', nullable: true },
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
            includeSummary: { type: 'boolean', default: false },
            role: { type: 'string' },
            signupMethod: { type: 'string' },
            subscriptionStatus: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              summary: { type: ['object', 'null'], nullable: true },
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string' },
                    premiumUntil: { type: ['string', 'null'] },
                    signupMethod: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    hasActiveSubscription: { type: 'boolean' },
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
      const raw = request.query as Record<string, unknown>;
      const q = typeof raw.query === 'string' ? raw.query.trim() : '';
      const limit = clampInt(raw.limit ?? 20, 1, 100);
      const offset = clampInt(raw.offset ?? 0, 0, 10000);
      const includeSummaryRaw = raw.includeSummary;
      const includeSummary =
        includeSummaryRaw === true ||
        includeSummaryRaw === 'true' ||
        includeSummaryRaw === '1' ||
        includeSummaryRaw === 1;

      const roleFilter = typeof raw.role === 'string' ? raw.role.trim() : '';
      const signupMethodFilter =
        typeof raw.signupMethod === 'string' ? raw.signupMethod.trim() : '';
      const subscriptionStatus =
        typeof raw.subscriptionStatus === 'string' ? raw.subscriptionStatus.trim() : '';

      const parts: Prisma.UserWhereInput[] = [];
      if (q) parts.push({ email: { contains: q, mode: 'insensitive' } });
      if (roleFilter) parts.push({ role: roleFilter as UserRole });
      if (signupMethodFilter) {
        parts.push({ signupMethod: signupMethodFilter as SignupMethod });
      }
      if (subscriptionStatus === 'active') {
        parts.push({
          subscriptions: { some: { status: { in: ACTIVE_SUB_STATUSES } } },
        });
      } else if (subscriptionStatus === 'none') {
        parts.push({
          NOT: {
            subscriptions: { some: { status: { in: ACTIVE_SUB_STATUSES } } },
          },
        });
      }

      const where: Prisma.UserWhereInput | undefined =
        parts.length > 0 ? { AND: parts } : undefined;

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          premiumUntil: true,
          signupMethod: true,
          createdAt: true,
          updatedAt: true,
          subscriptions: {
            where: { status: { in: ACTIVE_SUB_STATUSES } },
            take: 1,
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      let summary: {
        totalUsers: number;
        premiumUsers: number;
        roleCounts: Record<string, number>;
      } | null = null;

      if (includeSummary && !q) {
        const [totalUsers, premiumUsers, roleBy] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { premiumUntil: { gt: new Date() } } }),
          prisma.user.groupBy({
            by: ['role'],
            _count: { id: true },
          }),
        ]);

        const roleCounts: Record<string, number> = {};
        for (const row of roleBy) {
          roleCounts[row.role] = row._count.id;
        }

        summary = { totalUsers, premiumUsers, roleCounts };
      }

      return {
        summary,
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          premiumUntil: u.premiumUntil?.toISOString() ?? null,
          signupMethod: u.signupMethod ?? null,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          hasActiveSubscription: u.subscriptions.length > 0,
        })),
      };
    }
  );

  // GET ficha completa (perfil + org + contadores)
  fastify.get(
    '/admin/users/:id',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                  premiumUntil: { type: ['string', 'null'] },
                  signupMethod: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  daysRemaining: { type: 'number' },
                  organizationId: { type: ['string', 'null'] },
                  profile: { type: ['object', 'null'] },
                  organization: { type: ['object', 'null'] },
                },
              },
              stats: { type: 'object' },
              subscriptionsRecent: { type: 'array' },
            },
          },
        },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const now = new Date();

      const user = await prisma.user.findUnique({
        where: { id },
        include: { profile: true, organization: true },
      });
      if (!user) throw fastify.httpErrors.notFound('Usuario no encontrado');

      const [savedListsCount, savedItemsCount, savedSearchesCount, leadsCount, visitsCount] =
        await Promise.all([
          prisma.savedList.count({ where: { userId: id } }),
          prisma.savedItem.count({ where: { userId: id } }),
          prisma.savedSearch.count({ where: { userId: id } }),
          prisma.lead.count({ where: { userId: id } }),
          prisma.visit.count({ where: { lead: { userId: id } } }),
        ]);

      const subscriptionRecent = await prisma.subscription.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, plan: true, status: true, provider: true, currentPeriodEnd: true },
      });

      const premiumUntil = user.premiumUntil?.toISOString() ?? null;
      const isPremium = !!(user.premiumUntil && user.premiumUntil > now);
      const daysRemaining = isPremium
        ? Math.max(
            0,
            Math.ceil((user.premiumUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          )
        : 0;

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          premiumUntil,
          signupMethod: user.signupMethod ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          daysRemaining,
          organizationId: user.organizationId ?? null,
          profile: user.profile ?? null,
          organization: user.organization ?? null,
        },
        stats: {
          savedListsCount,
          savedItemsCount,
          savedSearchesCount,
          leadsCount,
          visitsCount,
        },
        subscriptionsRecent: subscriptionRecent.map((s) => ({
          id: s.id,
          plan: s.plan,
          status: s.status,
          provider: s.provider,
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        })),
      };
    }
  );

  // PATCH perfil (admin)
  fastify.patch(
    '/admin/users/:id/profile',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            firstName: { type: ['string', 'null'] },
            lastName: { type: ['string', 'null'] },
            dni: { type: ['string', 'null'] },
            matricula: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            whatsapp: { type: ['string', 'null'] },
            telegram: { type: ['string', 'null'] },
            twitter: { type: ['string', 'null'] },
            instagram: { type: ['string', 'null'] },
            facebook: { type: ['string', 'null'] },
            website: { type: ['string', 'null'] },
            address: { type: ['string', 'null'] },
            avatarUrl: { type: ['string', 'null'] },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const profileData: Record<string, string | null> = {};
      const allowed = [
        'firstName',
        'lastName',
        'dni',
        'matricula',
        'phone',
        'whatsapp',
        'telegram',
        'twitter',
        'instagram',
        'facebook',
        'website',
        'address',
        'avatarUrl',
      ];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        const v = body[key];
        profileData[key] = typeof v === 'string' ? v.trim() || null : null;
      }

      await prisma.userProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...profileData },
        update: profileData,
      });

      return { ok: true };
    }
  );

  // PATCH organización (admin) - edita la organización asociada al usuario
  fastify.patch(
    '/admin/users/:id/organization',
    {
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            commercialName: { type: ['string', 'null'] },
            address: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            whatsapp: { type: ['string', 'null'] },
            telegram: { type: ['string', 'null'] },
            twitter: { type: ['string', 'null'] },
            instagram: { type: ['string', 'null'] },
            facebook: { type: ['string', 'null'] },
            website: { type: ['string', 'null'] },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
      preHandler: [fastify.requireRole([UserRole.ADMIN])],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      if (!user?.organizationId) {
        throw fastify.httpErrors.badRequest('El usuario no tiene organización asociada');
      }

      const orgData: Record<string, string | null> = {};
      const allowed = [
        'name',
        'commercialName',
        'address',
        'phone',
        'whatsapp',
        'telegram',
        'twitter',
        'instagram',
        'facebook',
        'website',
      ];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        const v = body[key];
        if (key === 'name' && typeof v === 'string' && v.trim() === '') continue;
        orgData[key] = typeof v === 'string' ? v.trim() || null : null;
      }

      await prisma.organization.update({
        where: { id: user.organizationId },
        data: orgData,
      });

      return { ok: true };
    }
  );
}
