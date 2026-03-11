/**
 * Demo setup: solo cuando DEMO_MODE=1 y usuario autenticado.
 * Crea escenario listo para probar: búsqueda, lead, mensajes (uno bloqueado), visita.
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { LeadSource, LeadStatus, ActivationReason, MessageSenderType } from '@prisma/client';
import { processLeadActivatedEvent } from '../services/lead-delivery/processor.js';
import { filterPii } from '../lib/anti-pii.js';
import { trackEvent } from '../lib/analytics.js';

const DEMO_FILTERS = {
  operationType: 'SALE' as const,
  propertyType: ['APARTMENT', 'HOUSE'],
  priceMax: 150000,
  bedroomsMin: 2,
  locationText: 'Rosario',
  currency: 'USD',
};

export async function demoRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/demo/status',
    {
      schema: {
        tags: ['Demo'],
        response: {
          200: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ enabled: config.demoMode });
    }
  );

  fastify.post(
    '/demo/setup',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Demo'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              searchId: { type: 'string' },
              leadId: { type: 'string' },
              listingId: { type: 'string' },
              urls: {
                type: 'object',
                properties: {
                  searches: { type: 'string' },
                  leadChat: { type: 'string' },
                  leadDetail: { type: 'string' },
                  feedList: { type: 'string' },
                },
              },
            },
          },
          403: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      if (!config.demoMode) {
        throw fastify.httpErrors.forbidden('Demo deshabilitada');
      }

      const user = request.user as { userId: string };
      const appUrl = config.appUrl.replace(/\/$/, '');

      const listing = await prisma.listing.findFirst({
        where: { source: 'API_PARTNER_1', status: 'ACTIVE' },
      });
      if (!listing) {
        throw fastify.httpErrors.preconditionFailed('No hay listings demo. Ejecutá demo:data.');
      }

      const search = await prisma.savedSearch.create({
        data: {
          userId: user.userId,
          name: 'Demo Rosario 2 dorm',
          queryText: 'Depto 2 ambientes Rosario hasta 150k USD',
          filtersJson: DEMO_FILTERS,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.userId,
          listingId: listing.id,
          publisherId: listing.publisherId,
          channel: 'FORM',
          source: LeadSource.DEMO,
          message: 'Consulta desde demo',
          status: LeadStatus.PENDING,
        },
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { premiumUntil: true, role: true },
      });
      const isPremium =
        dbUser?.role === 'ADMIN' ||
        (dbUser?.premiumUntil && new Date(dbUser.premiumUntil) > new Date());

      if (isPremium) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.ACTIVE,
            activationReason: ActivationReason.PREMIUM_USER,
            activatedAt: new Date(),
          },
        });
        const evActivated = await prisma.outboxEvent.create({
          data: { type: 'LEAD_ACTIVATED', payload: { leadId: lead.id } },
        });
        await processLeadActivatedEvent(evActivated.id);
        await trackEvent('lead_activated', {
          userId: user.userId,
          payload: { leadId: lead.id, activationReason: 'PREMIUM_USER' },
        });
      } else {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.ACTIVE,
            activationReason: ActivationReason.MANUAL_ADMIN,
            activatedAt: new Date(),
          },
        });
        const evActivated = await prisma.outboxEvent.create({
          data: { type: 'LEAD_ACTIVATED', payload: { leadId: lead.id } },
        });
        await processLeadActivatedEvent(evActivated.id);
      }

      await prisma.message.create({
        data: {
          leadId: lead.id,
          senderType: MessageSenderType.BUYER,
          body: 'Hola, quiero coordinar visita',
          blockedReason: null,
        },
      });

      const { blocked, cleanBody, blockedReason } = filterPii(
        'Escribime a juan@example.com o entrá a https://foo.com'
      );
      await prisma.message.create({
        data: {
          leadId: lead.id,
          senderType: MessageSenderType.BUYER,
          body: blocked ? cleanBody : 'juan@example.com',
          blockedReason: blocked ? blockedReason : null,
        },
      });
      await trackEvent('message_blocked', {
        userId: user.userId,
        payload: { leadId: lead.id },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      await prisma.visit.create({
        data: {
          leadId: lead.id,
          scheduledAt: tomorrow,
          status: 'SCHEDULED',
        },
      });
      await trackEvent('visit_scheduled', {
        userId: user.userId,
        payload: { leadId: lead.id },
      });

      return reply.send({
        searchId: search.id,
        leadId: lead.id,
        listingId: listing.id,
        urls: {
          searches: `${appUrl}/searches/${search.id}`,
          leadChat: `${appUrl}/leads/${lead.id}/chat`,
          leadDetail: `${appUrl}/listing/${listing.id}`,
          feedList: `${appUrl}/feed/list`,
        },
      });
    }
  );
}
