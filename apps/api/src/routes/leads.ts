import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { envFlag } from '../config.js';
import {
  ActivationReason,
  LeadChannel,
  LeadSource,
  LeadStatus,
  LeadDeliveryAttemptKind,
  MessageSenderType,
} from '@prisma/client';
import {
  processLeadCreatedEvent,
  processLeadActivatedEvent,
} from '../services/lead-delivery/processor.js';
import { kitepropUserMessage } from '../services/kiteprop/error-messages.js';
import { trackEvent } from '../lib/analytics.js';
import { filterPii } from '../lib/anti-pii.js';

export async function leadRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/leads',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['listingId'],
          properties: {
            listingId: { type: 'string' },
            channel: { type: 'string', enum: ['WHATSAPP', 'FORM', 'TOUR_REQUEST'] },
            message: { type: 'string' },
            source: { type: 'string', enum: ['FEED', 'LIST', 'ASSISTANT', 'DETAIL'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              listingId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as {
        listingId: string;
        channel?: string;
        message?: string;
        source?: string;
      };

      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId },
        include: { publisher: { include: { endpoints: true } } },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      const publisherId = listing.publisherId ?? null;
      const channel = (body.channel as LeadChannel) ?? LeadChannel.FORM;
      const source = (body.source as LeadSource) ?? null;

      const lead = await prisma.lead.create({
        data: {
          userId: user.userId,
          listingId: body.listingId,
          publisherId,
          channel,
          source,
          message: body.message ?? null,
          status: LeadStatus.PENDING,
          targetPublisherRef: listing.publisherRef,
        },
      });

      const ev = await prisma.outboxEvent.create({
        data: {
          type: 'LEAD_CREATED',
          payload: { leadId: lead.id },
        },
      });

      await processLeadCreatedEvent(ev.id);
      await trackEvent('contact_requested', { userId: user.userId, payload: { leadId: lead.id } });
      await trackEvent('lead_created_pending', {
        userId: user.userId,
        payload: { leadId: lead.id },
      });

      return reply.status(201).send({
        id: lead.id,
        status: lead.status,
        listingId: lead.listingId,
      });
    }
  );

  fastify.get(
    '/me/leads',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                listingId: { type: 'string' },
                status: { type: 'string' },
                source: { type: 'string' },
                createdAt: { type: 'string' },
                listing: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    locationText: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const leads = await prisma.lead.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              currency: true,
              locationText: true,
              heroImageUrl: true,
              media: {
                orderBy: { sortOrder: 'asc' },
                select: { url: true, sortOrder: true },
              },
            },
          },
          deliveryAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      return leads.map((l) => {
        const lastAttempt = l.deliveryAttempts[0];
        const lastDelivery = lastAttempt
          ? {
              kind: lastAttempt.kind,
              status: lastAttempt.status,
              httpStatus: lastAttempt.httpStatus,
              createdAt: lastAttempt.createdAt.toISOString(),
              snippet: lastAttempt.responseBodySnippet,
              userMessage:
                lastAttempt.kind === LeadDeliveryAttemptKind.KITEPROP
                  ? kitepropUserMessage(
                      lastAttempt.httpStatus ?? 0,
                      lastAttempt.responseBodySnippet ?? ''
                    )
                  : undefined,
            }
          : null;
        const listing = l.listing;
        const listingOut = listing
          ? {
              ...listing,
              heroImageUrl: listing.heroImageUrl ?? listing.media?.[0]?.url ?? null,
              media: listing.media,
            }
          : listing;

        return {
          id: l.id,
          listingId: l.listingId,
          status: l.status,
          source: l.source,
          createdAt: l.createdAt.toISOString(),
          listing: listingOut,
          lastDelivery,
        };
      });
    }
  );

  fastify.post(
    '/leads/:id/activate',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              status: { type: 'string' },
              activationReason: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: leadId } = request.params as { id: string };

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId: user.userId },
        include: { user: { select: { premiumUntil: true } } },
      });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      if (lead.status === LeadStatus.ACTIVE) {
        return reply.send({
          ok: true,
          status: 'ACTIVE',
          activationReason: lead.activationReason,
        });
      }

      if (lead.status === LeadStatus.CLOSED) {
        throw fastify.httpErrors.badRequest('No se puede activar un lead cerrado');
      }

      let reason: ActivationReason | null = null;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { premiumUntil: true, role: true },
      });
      const premiumFree =
        envFlag('DEMO_MODE') ||
        envFlag('PREMIUM_FREE') ||
        envFlag('PREMIUM_GRACE_PERIOD') ||
        process.env.NODE_ENV === 'development';
      const simPremium =
        (process.env.NODE_ENV === 'development' || envFlag('DEMO_MODE')) &&
        ((request.cookies as Record<string, string> | undefined)?.['matchprop_premium_sim'] ===
          '1' ||
          (request.headers['x-premium-sim'] as string) === '1');

      if (dbUser?.role === 'ADMIN') {
        reason = ActivationReason.MANUAL_ADMIN;
      } else if (premiumFree) {
        reason = ActivationReason.PREMIUM_USER;
      } else if (dbUser?.premiumUntil && new Date(dbUser.premiumUntil) > new Date()) {
        reason = ActivationReason.PREMIUM_USER;
      } else if (simPremium) {
        reason = ActivationReason.PREMIUM_USER;
      }
      // PAID_BY_AGENCY: por ahora se activa manualmente vía otro endpoint (T2 dice "manual endpoint org")

      if (!reason) {
        throw fastify.httpErrors.forbidden(
          'No podés activar este lead. Requiere ser premium o compra de inmobiliaria.'
        );
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.ACTIVE,
          activationReason: reason,
          activatedAt: new Date(),
        },
      });

      const evActivated = await prisma.outboxEvent.create({
        data: {
          type: 'LEAD_ACTIVATED',
          payload: { leadId },
        },
      });
      await processLeadActivatedEvent(evActivated.id);
      await trackEvent('lead_activated', {
        userId: user.userId,
        payload: { leadId, activationReason: reason },
      });

      return reply.send({
        ok: true,
        status: 'ACTIVE',
        activationReason: reason,
      });
    }
  );

  fastify.get(
    '/leads/:id/messages',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: { 200: { type: 'array', items: { type: 'object' } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: leadId } = request.params as { id: string };

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId: user.userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      return reply.send(
        lead.messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          body: m.body,
          blockedReason: m.blockedReason,
          createdAt: m.createdAt.toISOString(),
        }))
      );
    }
  );

  fastify.post(
    '/leads/:id/messages',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        body: { type: 'object', required: ['body'], properties: { body: { type: 'string' } } },
        response: { 201: { type: 'object', properties: { id: { type: 'string' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: leadId } = request.params as { id: string };
      const body = request.body as { body: string };

      const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: user.userId } });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      if (lead.status !== LeadStatus.ACTIVE) {
        throw fastify.httpErrors.forbidden('Activá el lead para chatear');
      }

      const { blocked, cleanBody, blockedReason } = filterPii(body.body ?? '');
      const message = await prisma.message.create({
        data: {
          leadId,
          senderType: MessageSenderType.BUYER,
          body: blocked ? cleanBody : body.body,
          blockedReason: blocked ? blockedReason : null,
        },
      });

      if (blocked) {
        await trackEvent('message_blocked', {
          userId: user.userId,
          payload: { leadId, messageId: message.id },
        });
      } else {
        await trackEvent('chat_message_sent', {
          userId: user.userId,
          payload: { leadId, messageId: message.id },
        });
      }

      return reply.status(201).send({ id: message.id });
    }
  );

  fastify.get(
    '/leads/:id/visits',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: { 200: { type: 'array', items: { type: 'object' } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: leadId } = request.params as { id: string };

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId: user.userId },
        include: { visits: { orderBy: { scheduledAt: 'asc' } } },
      });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      if (lead.status !== LeadStatus.ACTIVE) {
        throw fastify.httpErrors.forbidden('Activá el lead para agendar visitas');
      }

      return reply.send(
        lead.visits.map((v) => ({
          id: v.id,
          scheduledAt: v.scheduledAt.toISOString(),
          status: v.status,
          createdAt: v.createdAt.toISOString(),
        }))
      );
    }
  );

  fastify.post(
    '/leads/:id/visits',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        body: {
          type: 'object',
          required: ['scheduledAt'],
          properties: { scheduledAt: { type: 'string', format: 'date-time' } },
        },
        response: { 201: { type: 'object', properties: { id: { type: 'string' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: leadId } = request.params as { id: string };
      const body = request.body as { scheduledAt: string };

      const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: user.userId } });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      if (lead.status !== LeadStatus.ACTIVE) {
        throw fastify.httpErrors.forbidden('Activá el lead para agendar visitas');
      }

      const scheduledAt = new Date(body.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw fastify.httpErrors.badRequest('scheduledAt debe ser futuro');
      }

      const visit = await prisma.visit.create({
        data: { leadId, scheduledAt, status: 'SCHEDULED' },
      });

      await trackEvent('visit_scheduled', {
        userId: user.userId,
        payload: { leadId, visitId: visit.id },
      });

      return reply.status(201).send({ id: visit.id });
    }
  );

  fastify.get(
    '/me/visits',
    {
      schema: {
        tags: ['Leads'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer' } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                scheduledAt: { type: 'string' },
                status: { type: 'string' },
                leadId: { type: 'string' },
                listingId: { type: 'string' },
                listingTitle: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const q = request.query as { limit?: number };
      const limit = Math.min(50, Math.max(1, q.limit ?? 20));
      const now = new Date();
      const visits = await prisma.visit.findMany({
        where: {
          lead: { userId: user.userId, status: LeadStatus.ACTIVE },
          scheduledAt: { gte: now },
          status: 'SCHEDULED',
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        include: {
          lead: { include: { listing: { select: { id: true, title: true } } } },
        },
      });
      return visits.map((v) => ({
        id: v.id,
        scheduledAt: v.scheduledAt.toISOString(),
        status: v.status,
        leadId: v.leadId,
        listingId: v.lead.listingId,
        listingTitle: v.lead.listing?.title ?? null,
      }));
    }
  );
}
