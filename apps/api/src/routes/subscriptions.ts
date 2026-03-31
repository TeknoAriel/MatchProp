/**
 * Sistema de Suscripciones y Pagos
 *
 * GET  /plans                    - Lista planes disponibles
 * GET  /me/subscription          - Suscripción actual del usuario
 * POST /me/subscription          - Crear/actualizar suscripción
 * POST /me/subscription/cancel   - Cancelar suscripción
 * GET  /me/payments              - Historial de pagos
 * POST /me/subscription/upgrade  - Upgrade de plan
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { UserRole, PaymentProvider } from '@prisma/client';
import { isMercadoPagoConfigured } from '../lib/mercadopago.js';
import { PLANS, ORG_DISCOUNT } from '../lib/plans.js';

export { PLANS };

export async function subscriptionRoutes(fastify: FastifyInstance) {
  // GET /plans - Planes públicos (no requiere auth)
  fastify.get(
    '/plans',
    {
      schema: {
        tags: ['Subscriptions'],
        response: {
          200: {
            type: 'object',
            properties: {
              plans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    priceMonthly: { type: 'number' },
                    priceYearly: { type: 'number' },
                    features: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        plans: Object.values(PLANS).map((p) => ({
          ...p,
          priceMonthly: p.priceMonthly / 100,
          priceYearly: p.priceYearly / 100,
        })),
      };
    }
  );

  // Rutas autenticadas
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /me/subscription - Suscripción actual
  fastify.get(
    '/me/subscription',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              subscription: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  plan: { type: 'string' },
                  status: { type: 'string' },
                  currentPeriodStart: { type: 'string' },
                  currentPeriodEnd: { type: 'string' },
                  cancelAtPeriodEnd: { type: 'boolean' },
                  daysRemaining: { type: 'number' },
                },
              },
              user: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  premiumUntil: { type: ['string', 'null'] },
                  isPremium: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };

      const [dbUser, subscription] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.userId },
          select: { role: true, premiumUntil: true },
        }),
        prisma.subscription.findFirst({
          where: {
            userId: user.userId,
            status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (!dbUser) throw fastify.httpErrors.unauthorized();

      const isPremium = !!(dbUser.premiumUntil && dbUser.premiumUntil > new Date());
      const daysRemaining = subscription
        ? Math.max(
            0,
            Math.ceil(
              (subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0;

      return {
        subscription: subscription
          ? {
              id: subscription.id,
              plan: subscription.plan,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              daysRemaining,
            }
          : null,
        user: {
          role: dbUser.role,
          premiumUntil: dbUser.premiumUntil?.toISOString() ?? null,
          isPremium,
        },
      };
    }
  );

  // POST /me/subscription - Crear/activar suscripción
  fastify.post(
    '/me/subscription',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['plan'],
          properties: {
            plan: { type: 'string', enum: ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'] },
            billingCycle: { type: 'string', enum: ['monthly', 'yearly'], default: 'monthly' },
            provider: {
              type: 'string',
              enum: ['STRIPE', 'MERCADO_PAGO', 'MANUAL'],
              default: 'STRIPE',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              subscription: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      plan: { type: 'string' },
                      status: { type: 'string' },
                      currentPeriodEnd: { type: 'string' },
                      priceUsd: { type: 'number' },
                      hasOrgDiscount: { type: 'boolean' },
                    },
                  },
                ],
              },
              checkoutUrl: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      const body = request.body as {
        plan: keyof typeof PLANS;
        billingCycle?: 'monthly' | 'yearly';
        provider?: PaymentProvider;
      };

      const plan = PLANS[body.plan];
      if (!plan) {
        return reply.status(400).send({ message: 'Plan inválido' });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, role: true },
      });

      const resolvedProvider = body.provider ?? 'STRIPE';
      if (resolvedProvider !== 'MANUAL') {
        const mpOk = isMercadoPagoConfigured();
        const stripeOk = !!process.env.STRIPE_SECRET_KEY;
        if (!mpOk && !stripeOk) {
          return reply.status(400).send({
            message:
              'No hay proveedores de pago configurados. En prueba usá provider MANUAL o configurá Stripe/Mercado Pago.',
          });
        }
        const baseUrl = (
          process.env.FRONTEND_URL ||
          process.env.APP_URL ||
          'https://matchprop.vercel.app'
        ).replace(/\/$/, '');
        const bc = body.billingCycle ?? 'monthly';
        return {
          subscription: null,
          checkoutUrl: `${baseUrl}/me/checkout?plan=${encodeURIComponent(body.plan)}&billingCycle=${encodeURIComponent(bc)}`,
        };
      }

      // MANUAL: activación inmediata (modo prueba / demo)
      const hasOrgDiscount =
        (body.plan === 'AGENT' || body.plan === 'REALTOR') && !!dbUser?.organizationId;
      const basePrice = body.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
      const finalPrice = hasOrgDiscount ? Math.round(basePrice * (1 - ORG_DISCOUNT)) : basePrice;

      const periodEnd = new Date();
      if (body.billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const subscription = await prisma.subscription.create({
        data: {
          userId,
          plan: body.plan as UserRole,
          status: 'ACTIVE',
          provider: 'MANUAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      // Crear registro de pago
      const now = new Date();
      await prisma.payment.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          amount: finalPrice,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'MANUAL',
          description: `Suscripción ${plan.name} - ${body.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}`,
          paidAt: now,
        },
      });

      // Actualizar rol y premium del usuario
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: body.plan as UserRole,
          premiumUntil: periodEnd,
        },
      });

      return {
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          priceUsd: finalPrice / 100,
          hasOrgDiscount,
        },
        checkoutUrl: null,
      };
    }
  );

  // POST /me/subscription/cancel - Cancelar suscripción
  fastify.post(
    '/me/subscription/cancel',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            immediate: { type: 'boolean', default: false },
            reason: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              endsAt: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      const body = request.body as { immediate?: boolean; reason?: string };

      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        return reply.status(404).send({ message: 'No tenés una suscripción activa' });
      }

      if (body.immediate) {
        // Cancelación inmediata
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            role: 'BUYER',
            premiumUntil: null,
          },
        });

        return {
          ok: true,
          message: 'Suscripción cancelada. Tu cuenta volvió al plan gratuito.',
          endsAt: null,
        };
      } else {
        // Cancelar al fin del período
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            cancelAtPeriodEnd: true,
          },
        });

        return {
          ok: true,
          message: `Tu suscripción se cancelará el ${subscription.currentPeriodEnd.toLocaleDateString()}`,
          endsAt: subscription.currentPeriodEnd.toISOString(),
        };
      }
    }
  );

  // GET /me/payments - Historial de pagos
  fastify.get(
    '/me/payments',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              payments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    paidAt: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = (request.user as { userId: string }).userId;
      const query = request.query as { limit?: number; offset?: number };
      const limit = Math.min(50, query.limit ?? 20);
      const offset = query.offset ?? 0;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.payment.count({ where: { userId } }),
      ]);

      return {
        payments: payments.map((p) => ({
          id: p.id,
          amount: p.amount / 100,
          currency: p.currency,
          status: p.status,
          description: p.description,
          paidAt: p.paidAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        total,
      };
    }
  );

  // POST /me/subscription/upgrade - Cambiar de plan
  fastify.post(
    '/me/subscription/upgrade',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['newPlan'],
          properties: {
            newPlan: { type: 'string', enum: ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              proratedAmount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      const body = request.body as { newPlan: keyof typeof PLANS };

      const currentSub = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentSub) {
        return reply.status(400).send({
          message: 'No tenés una suscripción activa. Creá una nueva.',
        });
      }

      const currentPlan = PLANS[currentSub.plan as keyof typeof PLANS];
      const newPlan = PLANS[body.newPlan];

      if (!newPlan) {
        return reply.status(400).send({ message: 'Plan inválido' });
      }

      // Calcular prorrateo
      const daysRemaining = Math.max(
        0,
        Math.ceil((currentSub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      const daysInPeriod = 30;
      const currentDailyRate = currentPlan.priceMonthly / daysInPeriod;
      const newDailyRate = newPlan.priceMonthly / daysInPeriod;
      const creditRemaining = Math.round(currentDailyRate * daysRemaining);
      const newCost = Math.round(newDailyRate * daysRemaining);
      const proratedAmount = Math.max(0, newCost - creditRemaining);

      // Actualizar suscripción
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          plan: body.newPlan as UserRole,
        },
      });

      // Actualizar usuario
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: body.newPlan as UserRole,
        },
      });

      const isUpgrade = newPlan.priceMonthly > currentPlan.priceMonthly;

      return {
        ok: true,
        message: isUpgrade ? `Upgrade a ${newPlan.name} completado!` : `Cambiado a ${newPlan.name}`,
        proratedAmount: proratedAmount / 100,
      };
    }
  );

  // GET /me/subscription/usage - Uso del plan actual
  fastify.get(
    '/me/subscription/usage',
    {
      schema: {
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              plan: { type: 'string' },
              usage: {
                type: 'object',
                properties: {
                  savedSearches: { type: 'number' },
                  savedLists: { type: 'number' },
                  alertsActive: { type: 'number' },
                  leadsThisMonth: { type: 'number' },
                },
              },
              limits: {
                type: 'object',
                properties: {
                  savedSearches: { type: ['number', 'null'] },
                  savedLists: { type: ['number', 'null'] },
                  alertsActive: { type: ['number', 'null'] },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = (request.user as { userId: string }).userId;

      const [user, savedSearches, savedLists, alertsActive, leadsThisMonth] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        prisma.savedSearch.count({ where: { userId } }),
        prisma.savedList.count({ where: { userId } }),
        prisma.alertSubscription.count({ where: { userId, isEnabled: true } }),
        prisma.lead.count({
          where: {
            userId,
            createdAt: { gte: new Date(new Date().setDate(1)) },
          },
        }),
      ]);

      // Durante pruebas: todos los planes sin límites
      const limits: Record<string, Record<string, number | null>> = {
        BUYER: { savedSearches: null, savedLists: null, alertsActive: null },
        AGENT: { savedSearches: null, savedLists: null, alertsActive: null },
        REALTOR: { savedSearches: null, savedLists: null, alertsActive: null },
        INMOBILIARIA: { savedSearches: null, savedLists: null, alertsActive: null },
      };

      const planLimits = limits[user?.role ?? 'BUYER'] ?? limits.BUYER;

      return {
        plan: user?.role ?? 'BUYER',
        usage: {
          savedSearches,
          savedLists,
          alertsActive,
          leadsThisMonth,
        },
        limits: planLimits,
      };
    }
  );
}
