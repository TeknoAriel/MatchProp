/**
 * Sprint 9: Premium B2C vía Stripe (Payment Adapter).
 * POST /me/checkout-session → crea Stripe Checkout Session (Premium mensual por rol)
 * POST /webhooks/stripe → webhook Stripe (checkout.session.completed → premiumUntil)
 *
 * Precios por rol (env): STRIPE_PRICE_BUYER (1 USD), STRIPE_PRICE_AGENT (3), STRIPE_PRICE_REALTOR (5), STRIPE_PRICE_INMOBILIARIA (10)
 * STRIPE_COUPON_ORG_20 = 20% descuento para agentes/corredores bajo inmobiliaria
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { featureFlags } from '../config.js';
import { createStripeProvider } from '../lib/payments/stripe-provider.js';

const FALLBACK_PRICE = 'price_premium_monthly';
const PRICE_KEYS: Record<string, string> = {
  BUYER: 'STRIPE_PRICE_BUYER',
  AGENT: 'STRIPE_PRICE_AGENT',
  REALTOR: 'STRIPE_PRICE_REALTOR',
  INMOBILIARIA: 'STRIPE_PRICE_INMOBILIARIA',
};

function getPriceIdForRole(role: string): string {
  const envKey = PRICE_KEYS[role];
  const price = envKey ? process.env[envKey] : null;
  return price || process.env.STRIPE_PRICE_ID || FALLBACK_PRICE;
}

export async function stripeRoutes(fastify: FastifyInstance) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const couponOrg20 = process.env.STRIPE_COUPON_ORG_20;

  if (!stripeSecretKey) {
    fastify.log.info('Stripe routes not registered (STRIPE_SECRET_KEY missing)');
    return;
  }

  const paymentProvider = createStripeProvider(stripeSecretKey);

  fastify.addHook('preHandler', async (request, _reply) => {
    if (request.url.includes('/webhooks/stripe')) return;
    return fastify.authenticate(request);
  });

  // Checkout session (Premium) — requiere auth
  fastify.post(
    '/me/checkout-session',
    {
      schema: {
        tags: ['Stripe'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              sessionId: { type: 'string' },
            },
          },
          501: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      if (!featureFlags.stripePremium || !stripeSecretKey) {
        return reply.status(501).send({
          message: 'Premium B2C no configurado. Set STRIPE_SECRET_KEY.',
        });
      }

      const user = request.user as { userId: string; email?: string };
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, role: true, organizationId: true },
      });
      if (!dbUser) throw fastify.httpErrors.unauthorized();

      const priceId = getPriceIdForRole(dbUser.role);
      const hasOrgDiscount =
        (dbUser.role === 'AGENT' || dbUser.role === 'REALTOR') &&
        !!dbUser.organizationId &&
        !!couponOrg20;

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      try {
        const result = await paymentProvider.createCheckoutSession({
          userId: user.userId,
          customerEmail: dbUser.email ?? undefined,
          successUrl: `${baseUrl}/feed?premium=ok`,
          cancelUrl: `${baseUrl}/feed`,
          priceId,
          couponId: hasOrgDiscount ? couponOrg20 : undefined,
        });
        return { url: result.url, sessionId: result.sessionId };
      } catch (err) {
        request.log.error(err, 'Stripe checkout session failed');
        throw fastify.httpErrors.internalServerError('Error al crear sesión de pago');
      }
    }
  );

  // Webhook Stripe — sin auth, verifica firma
  fastify.post(
    '/webhooks/stripe',
    {
      config: { rawBody: true },
      schema: {
        tags: ['Stripe'],
        response: { 200: { type: 'object', properties: { received: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      if (!stripeWebhookSecret || !stripeSecretKey) {
        return reply.status(501).send({ received: false });
      }

      const rawBody = (request as { rawBody?: Buffer }).rawBody;
      const sig = request.headers['stripe-signature'] as string | undefined;
      if (!rawBody || !sig) {
        return reply.status(400).send({ received: false });
      }

      const event = await paymentProvider.constructWebhookEvent(rawBody, sig, stripeWebhookSecret);
      if (!event) {
        request.log.warn('Stripe webhook signature invalid');
        return reply.status(400).send({ received: false });
      }

      try {
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as { client_reference_id?: string };
          const userId = session.client_reference_id;
          if (userId) {
            const until = new Date();
            until.setMonth(until.getMonth() + 1);
            await prisma.user.update({
              where: { id: userId },
              data: { premiumUntil: until },
            });
          }
        }
        return { received: true };
      } catch (err) {
        request.log.error(err, 'Stripe webhook handler failed');
        return reply.status(400).send({ received: false });
      }
    }
  );
}
