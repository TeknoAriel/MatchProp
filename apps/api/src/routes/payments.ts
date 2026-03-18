/**
 * Payment Routes - Mercado Pago + Stripe
 * 
 * POST /payments/checkout          - Crear sesión de checkout (MP o Stripe)
 * POST /payments/webhook/mp        - Webhook de Mercado Pago (IPN)
 * POST /payments/webhook/stripe    - Webhook de Stripe
 * GET  /payments/config            - Configuración de pagos para el frontend
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { PaymentStatus, PaymentProvider, UserRole } from '@prisma/client';
import {
  createPreference,
  getPayment,
  isMercadoPagoConfigured,
  getMercadoPagoPublicKey,
  mapMPStatusToPaymentStatus,
  verifyWebhookSignature,
} from '../lib/mercadopago.js';
import { PLANS } from './subscriptions.js';

// Tipo de cambio aproximado USD -> ARS (actualizar periódicamente o usar API)
const USD_TO_ARS = 1000; // $1 USD = $1000 ARS aproximadamente

export async function paymentRoutes(fastify: FastifyInstance) {
  // GET /payments/config - Configuración para el frontend (público)
  fastify.get(
    '/payments/config',
    {
      schema: {
        tags: ['Payments'],
        response: {
          200: {
            type: 'object',
            properties: {
              providers: {
                type: 'object',
                properties: {
                  mercadopago: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      publicKey: { type: ['string', 'null'] },
                    },
                  },
                  stripe: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      publicKey: { type: ['string', 'null'] },
                    },
                  },
                },
              },
              defaultProvider: { type: 'string' },
              currency: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      const mpEnabled = isMercadoPagoConfigured();
      const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

      return {
        providers: {
          mercadopago: {
            enabled: mpEnabled,
            publicKey: getMercadoPagoPublicKey(),
          },
          stripe: {
            enabled: stripeEnabled,
            publicKey: process.env.STRIPE_PUBLIC_KEY ?? null,
          },
        },
        defaultProvider: mpEnabled ? 'MERCADO_PAGO' : stripeEnabled ? 'STRIPE' : 'MANUAL',
        currency: mpEnabled ? 'ARS' : 'USD',
      };
    }
  );

  // POST /payments/checkout - Crear sesión de checkout
  fastify.post(
    '/payments/checkout',
    {
      schema: {
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['plan'],
          properties: {
            plan: { type: 'string', enum: ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'] },
            billingCycle: { type: 'string', enum: ['monthly', 'yearly'], default: 'monthly' },
            provider: { type: 'string', enum: ['MERCADO_PAGO', 'STRIPE'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              checkoutUrl: { type: 'string' },
              provider: { type: 'string' },
              preferenceId: { type: ['string', 'null'] },
            },
          },
          400: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      const body = request.body as {
        plan: keyof typeof PLANS;
        billingCycle?: 'monthly' | 'yearly';
        provider?: 'MERCADO_PAGO' | 'STRIPE';
      };

      const plan = PLANS[body.plan];
      if (!plan) {
        return reply.status(400).send({ message: 'Plan inválido' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, organizationId: true },
      });

      if (!user) {
        return reply.status(401).send({ message: 'Usuario no encontrado' });
      }

      // Determinar provider
      const mpEnabled = isMercadoPagoConfigured();
      const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
      let provider: PaymentProvider = body.provider === 'STRIPE' ? 'STRIPE' : 'MERCADO_PAGO';

      if (provider === 'MERCADO_PAGO' && !mpEnabled) {
        if (stripeEnabled) provider = 'STRIPE';
        else return reply.status(400).send({ message: 'No hay proveedores de pago configurados' });
      }
      if (provider === 'STRIPE' && !stripeEnabled) {
        if (mpEnabled) provider = 'MERCADO_PAGO';
        else return reply.status(400).send({ message: 'No hay proveedores de pago configurados' });
      }

      // Calcular precio
      const hasOrgDiscount = (body.plan === 'AGENT' || body.plan === 'REALTOR') && !!user.organizationId;
      const basePriceUSD = body.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
      const finalPriceUSD = hasOrgDiscount ? Math.round(basePriceUSD * 0.8) : basePriceUSD;

      // Calcular fecha de fin
      const periodEnd = new Date();
      if (body.billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Crear suscripción pendiente
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          plan: body.plan as UserRole,
          status: 'PENDING',
          provider,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      // External reference: subscriptionId para trackear
      const externalRef = `sub_${subscription.id}`;
      const baseUrl = process.env.FRONTEND_URL || 'https://matchprop.vercel.app';
      const apiUrl = process.env.API_URL || 'https://matchprop-api.vercel.app';

      if (provider === 'MERCADO_PAGO') {
        // Precio en ARS
        const priceARS = Math.round((finalPriceUSD / 100) * USD_TO_ARS);

        const preference = await createPreference({
          title: `MatchProp ${plan.name} - ${body.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}`,
          description: plan.description,
          unitPrice: priceARS,
          currency: 'ARS',
          externalReference: externalRef,
          payerEmail: user.email,
          backUrls: {
            success: `${baseUrl}/me/premium?status=success`,
            failure: `${baseUrl}/me/premium?status=failure`,
            pending: `${baseUrl}/me/premium?status=pending`,
          },
          autoReturn: 'approved',
          notificationUrl: `${apiUrl}/payments/webhook/mp`,
          metadata: {
            userId,
            subscriptionId: subscription.id,
            plan: body.plan,
            billingCycle: body.billingCycle,
          },
        });

        // Crear registro de pago pendiente
        await prisma.payment.create({
          data: {
            userId,
            subscriptionId: subscription.id,
            amount: finalPriceUSD,
            currency: 'USD',
            status: 'PENDING',
            provider: 'MERCADO_PAGO',
            providerPaymentId: preference.id,
            description: `Suscripción ${plan.name}`,
          },
        });

        // Usar sandbox en desarrollo
        const isDev = process.env.NODE_ENV !== 'production';
        const checkoutUrl = isDev ? preference.sandboxInitPoint : preference.initPoint;

        return {
          checkoutUrl,
          provider: 'MERCADO_PAGO',
          preferenceId: preference.id,
        };
      }

      // STRIPE (placeholder - implementar cuando sea necesario)
      if (provider === 'STRIPE') {
        // TODO: Implementar Stripe Checkout
        return reply.status(501).send({ 
          message: 'Stripe checkout aún no implementado. Usá Mercado Pago.' 
        });
      }

      return reply.status(400).send({ message: 'Provider no soportado' });
    }
  );

  // POST /payments/webhook/mp - Webhook de Mercado Pago (IPN)
  fastify.post(
    '/payments/webhook/mp',
    {
      schema: {
        tags: ['Payments'],
        body: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            action: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
        response: {
          200: { type: 'object', properties: { received: { type: 'boolean' } } },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        type?: string;
        action?: string;
        data?: { id?: string };
      };

      // Verificar firma si está configurada
      const signature = request.headers['x-signature'] as string | undefined;
      const requestId = request.headers['x-request-id'] as string | undefined;
      const rawBody = JSON.stringify(body);

      if (!verifyWebhookSignature(rawBody, signature, requestId)) {
        fastify.log.warn('Webhook MP: firma inválida');
        return reply.status(401).send({ message: 'Firma inválida' });
      }

      // Solo procesar notificaciones de pago
      if (body.type !== 'payment') {
        return { received: true };
      }

      const paymentId = body.data?.id;
      if (!paymentId) {
        return { received: true };
      }

      try {
        // Obtener detalles del pago desde MP
        const mpPayment = await getPayment(paymentId);
        fastify.log.info(`Webhook MP: pago ${paymentId} status=${mpPayment.status}`);

        // Buscar la suscripción por external_reference
        const externalRef = mpPayment.externalReference;
        if (!externalRef?.startsWith('sub_')) {
          fastify.log.warn(`Webhook MP: external_reference inválido: ${externalRef}`);
          return { received: true };
        }

        const subscriptionId = externalRef.replace('sub_', '');
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: { user: true },
        });

        if (!subscription) {
          fastify.log.warn(`Webhook MP: suscripción no encontrada: ${subscriptionId}`);
          return { received: true };
        }

        // Mapear estado
        const newStatus = mapMPStatusToPaymentStatus(mpPayment.status);

        // Actualizar pago
        await prisma.payment.updateMany({
          where: {
            subscriptionId,
            provider: 'MERCADO_PAGO',
            status: 'PENDING',
          },
          data: {
            status: newStatus as PaymentStatus,
            providerPaymentId: String(mpPayment.id),
            paidAt: mpPayment.dateApproved ? new Date(mpPayment.dateApproved) : null,
          },
        });

        // Si el pago fue aprobado, activar suscripción
        if (mpPayment.status === 'approved') {
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'ACTIVE' },
          });

          // Actualizar usuario
          await prisma.user.update({
            where: { id: subscription.userId },
            data: {
              role: subscription.plan,
              premiumUntil: subscription.currentPeriodEnd,
            },
          });

          fastify.log.info(`Suscripción ${subscriptionId} activada para user ${subscription.userId}`);
        }

        // Si el pago fue rechazado, marcar suscripción como cancelada
        if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'CANCELLED' },
          });
        }

        return { received: true };
      } catch (error) {
        fastify.log.error(`Error procesando webhook MP: ${error}`);
        return reply.status(500).send({ message: 'Error procesando webhook' });
      }
    }
  );

  // POST /payments/webhook/stripe - Webhook de Stripe (placeholder)
  fastify.post(
    '/payments/webhook/stripe',
    {
      schema: {
        tags: ['Payments'],
        response: {
          200: { type: 'object', properties: { received: { type: 'boolean' } } },
        },
      },
    },
    async () => {
      // TODO: Implementar webhook de Stripe cuando sea necesario
      return { received: true };
    }
  );

  // GET /payments/status/:subscriptionId - Estado de un pago (para polling)
  fastify.get(
    '/payments/status/:subscriptionId',
    {
      schema: {
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['subscriptionId'],
          properties: {
            subscriptionId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              subscription: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  plan: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const userId = (request.user as { userId: string }).userId;
      const params = request.params as { subscriptionId: string };

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: params.subscriptionId,
          userId,
        },
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!subscription) {
        return reply.status(404).send({ message: 'Suscripción no encontrada' });
      }

      const latestPayment = subscription.payments[0];

      return {
        status: latestPayment?.status ?? subscription.status,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
        },
      };
    }
  );
}
