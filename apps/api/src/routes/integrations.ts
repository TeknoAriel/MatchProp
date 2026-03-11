import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../lib/crypto.js';
import { LeadDeliveryAttemptKind, LeadDeliveryAttemptStatus } from '@prisma/client';
import {
  parseKitepropOpenAPI,
  parseKitepropOpenAPIFromContent,
  suggestTemplateFromSpec,
} from '../services/kiteprop/openapi.js';
import { deliverToKiteprop } from '../services/kiteprop/delivery.js';
import { parseSpecContent, detectSpecFormat } from '../services/kiteprop/spec-store.js';
import { renderPayloadTemplate } from '../services/kiteprop/payload-template.js';
import { kitepropUserMessage } from '../services/kiteprop/error-messages.js';

const SPEC_FETCH_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const SPEC_FETCH_TIMEOUT_MS = 10000;

export async function integrationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  const defaultConfig = parseKitepropOpenAPI();

  fastify.get(
    '/integrations/kiteprop',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string' },
              leadCreatePath: { type: 'string' },
              authHeaderName: { type: 'string' },
              authFormat: { type: 'string' },
              isEnabled: { type: 'boolean' },
              hasApiKey: { type: 'boolean' },
              hasSpec: { type: 'boolean' },
              payloadTemplate: { type: 'string' },
              payloadTemplatePending: { type: 'string' },
              payloadTemplateActive: { type: 'string' },
              lastTestOk: { type: 'boolean', nullable: true },
              lastTestHttpStatus: { type: 'number', nullable: true },
              lastTestAt: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const integration = await prisma.kitepropIntegration.findFirst({
        where: { userId: user.userId },
      });
      const spec = await prisma.kitepropOpenApiSpec.findFirst({
        where: { userId: user.userId },
      });
      return {
        baseUrl: integration?.baseUrl ?? defaultConfig?.baseUrl ?? 'https://api.kiteprop.com/v1',
        leadCreatePath: integration?.leadCreatePath ?? defaultConfig?.leadCreatePath ?? '/leads',
        authHeaderName: integration?.authHeaderName ?? defaultConfig?.authHeaderName ?? 'X-API-Key',
        authFormat: integration?.authFormat ?? defaultConfig?.authFormat ?? 'ApiKey',
        isEnabled: integration?.isEnabled ?? false,
        hasApiKey: !!integration?.apiKeyEncrypted,
        hasSpec: !!spec,
        payloadTemplate: integration?.payloadTemplate ?? '',
        payloadTemplatePending: integration?.payloadTemplatePending ?? '',
        payloadTemplateActive: integration?.payloadTemplateActive ?? '',
        lastTestOk: integration?.lastTestOk ?? null,
        lastTestHttpStatus: integration?.lastTestHttpStatus ?? null,
        lastTestAt: integration?.lastTestAt?.toISOString() ?? null,
      };
    }
  );

  fastify.put(
    '/integrations/kiteprop',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            baseUrl: { type: 'string' },
            leadCreatePath: { type: 'string' },
            authHeaderName: { type: 'string' },
            authFormat: { type: 'string', enum: ['Bearer', 'ApiKey'] },
            apiKey: { type: 'string' },
            isEnabled: { type: 'boolean' },
            payloadTemplate: { type: 'string' },
            payloadTemplatePending: { type: 'string' },
            payloadTemplateActive: { type: 'string' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as {
        baseUrl?: string;
        leadCreatePath?: string;
        authHeaderName?: string;
        authFormat?: string;
        apiKey?: string;
        isEnabled?: boolean;
        payloadTemplate?: string;
        payloadTemplatePending?: string;
        payloadTemplateActive?: string;
      };

      const masterKey = process.env.INTEGRATIONS_MASTER_KEY;
      if (body.apiKey && !masterKey) {
        throw fastify.httpErrors.preconditionFailed(
          'INTEGRATIONS_MASTER_KEY not set. Add to .env for encryption.'
        );
      }

      const data: {
        baseUrl?: string;
        leadCreatePath?: string;
        authHeaderName?: string;
        authFormat?: string;
        apiKeyEncrypted?: string;
        isEnabled?: boolean;
        payloadTemplate?: string;
        payloadTemplatePending?: string;
        payloadTemplateActive?: string;
      } = {
        baseUrl: body.baseUrl ?? defaultConfig?.baseUrl ?? 'https://api.kiteprop.com/v1',
        leadCreatePath: body.leadCreatePath ?? defaultConfig?.leadCreatePath ?? '/leads',
        authHeaderName: body.authHeaderName ?? defaultConfig?.authHeaderName ?? 'X-API-Key',
        authFormat: body.authFormat ?? defaultConfig?.authFormat ?? 'ApiKey',
        isEnabled: body.isEnabled ?? true,
        payloadTemplate: body.payloadTemplate ?? undefined,
        payloadTemplatePending: body.payloadTemplatePending ?? undefined,
        payloadTemplateActive: body.payloadTemplateActive ?? undefined,
      };
      if (body.apiKey) {
        data.apiKeyEncrypted = encrypt(body.apiKey);
      }

      await prisma.kitepropIntegration.upsert({
        where: { userId: user.userId },
        create: {
          userId: user.userId,
          baseUrl: data.baseUrl!,
          leadCreatePath: data.leadCreatePath!,
          authHeaderName: data.authHeaderName!,
          authFormat: data.authFormat!,
          apiKeyEncrypted: data.apiKeyEncrypted ?? null,
          payloadTemplate: data.payloadTemplate ?? null,
          payloadTemplatePending: data.payloadTemplatePending ?? null,
          payloadTemplateActive: data.payloadTemplateActive ?? null,
          isEnabled: data.isEnabled ?? true,
        },
        update: {
          ...data,
          apiKeyEncrypted: data.apiKeyEncrypted ?? undefined,
          payloadTemplate: data.payloadTemplate ?? undefined,
          payloadTemplatePending: data.payloadTemplatePending ?? undefined,
          payloadTemplateActive: data.payloadTemplateActive ?? undefined,
        },
      });
      return reply.send({ ok: true });
    }
  );

  fastify.post(
    '/integrations/kiteprop/test',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              httpStatus: { type: 'number' },
              snippet: { type: 'string' },
              userMessage: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const integration = await prisma.kitepropIntegration.findFirst({
        where: { userId: user.userId, isEnabled: true, apiKeyEncrypted: { not: null } },
      });
      if (!integration) {
        return reply.status(400).send({
          ok: false,
          httpStatus: 0,
          snippet: 'Configure API key first',
        });
      }

      const listing = await prisma.listing.findFirst({
        where: { status: 'ACTIVE' },
      });
      if (!listing) {
        return reply.status(400).send({
          ok: false,
          httpStatus: 0,
          snippet: 'No listings in DB for test',
        });
      }

      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { email: true },
      });

      const fakeLead = {
        id: 'test',
        userId: user.userId,
        listingId: listing.id,
        publisherId: null,
        channel: 'FORM' as const,
        source: 'FEED' as const,
        message: 'Lead de prueba desde MatchProp',
        status: 'PENDING' as const,
        targetPublisherRef: null,
        externalLeadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        listing: {
          externalId: listing.externalId,
          title: listing.title,
          price: listing.price,
          currency: listing.currency,
        },
        user: u ? { email: u.email } : null,
        publisher: { orgId: null },
      };

      const result = await deliverToKiteprop(fakeLead as Parameters<typeof deliverToKiteprop>[0], {
        testMode: true,
      });
      const userMessage = kitepropUserMessage(result.httpStatus, result.snippet ?? '');
      if (integration.id) {
        await prisma.kitepropIntegration.update({
          where: { id: integration.id },
          data: {
            lastTestOk: result.ok,
            lastTestHttpStatus: result.httpStatus ?? null,
            lastTestAt: new Date(),
          },
        });
      }
      return reply.send({
        ok: result.ok,
        httpStatus: result.httpStatus ?? 0,
        snippet: result.snippet ?? '',
        userMessage,
      });
    }
  );

  // --- Payload template preview (no send) ---
  fastify.post(
    '/integrations/kiteprop/render-preview',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: { template: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { payload: { type: 'object' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = (request.body as { template?: string }) ?? {};
      const listing = await prisma.listing.findFirst({ where: { status: 'ACTIVE' } });
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { email: true },
      });
      const template =
        body.template ??
        (
          await prisma.kitepropIntegration.findFirst({
            where: { userId: user.userId },
          })
        )?.payloadTemplate ??
        '';
      const context = {
        buyer: {
          email: u?.email ?? 'user@example.com',
          id: user.userId,
        },
        lead: { message: 'Mensaje de prueba', id: 'test-lead-id' },
        listing: {
          id: listing?.id ?? '',
          externalId: listing?.externalId ?? 'ext-1',
          title: listing?.title ?? 'Sin título',
          price: listing?.price ?? 0,
          currency: listing?.currency ?? 'USD',
          url: '',
        },
      };
      if (!template.trim()) {
        return reply.send({
          payload: {
            email: context.buyer.email,
            name: context.buyer.email.split('@')[0] ?? 'Usuario',
            message: context.lead.message,
            listing_id: context.listing.externalId,
          },
        });
      }
      try {
        const payload = renderPayloadTemplate(template, context);
        return reply.send({ payload });
      } catch (e) {
        throw fastify.httpErrors.badRequest(e instanceof Error ? e.message : 'Invalid template');
      }
    }
  );

  // --- OpenAPI Spec: fetch by URL ---
  fastify.post(
    '/integrations/kiteprop/spec/fetch',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { url } = request.body as { url: string };
      if (!url || typeof url !== 'string') {
        throw fastify.httpErrors.badRequest('url required');
      }
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw fastify.httpErrors.badRequest('Only https URLs allowed');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SPEC_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json, application/yaml, text/yaml' },
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw fastify.httpErrors.badRequest(`Fetch failed: ${res.status}`);
        }
        const contentLength = res.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > SPEC_FETCH_MAX_BYTES) {
          throw fastify.httpErrors.badRequest('Spec too large (max 2MB)');
        }
        const text = await res.text();
        if (text.length > SPEC_FETCH_MAX_BYTES) {
          throw fastify.httpErrors.badRequest('Spec too large (max 2MB)');
        }
        parseSpecContent(text);
        const format = detectSpecFormat(text);
        await prisma.kitepropOpenApiSpec.upsert({
          where: { userId: user.userId },
          create: { userId: user.userId, format, contentText: text },
          update: { format, contentText: text, updatedAt: new Date() },
        });
        return reply.send({ ok: true });
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          throw fastify.httpErrors.badRequest('Timeout downloading spec');
        }
        throw err;
      }
    }
  );

  // --- OpenAPI Spec: save pasted content ---
  fastify.post(
    '/integrations/kiteprop/spec/save',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { content } = request.body as { content: string };
      if (!content || typeof content !== 'string') {
        throw fastify.httpErrors.badRequest('content required');
      }
      if (content.length > SPEC_FETCH_MAX_BYTES) {
        throw fastify.httpErrors.badRequest('Spec too large (max 2MB)');
      }
      parseSpecContent(content);
      const format = detectSpecFormat(content);
      await prisma.kitepropOpenApiSpec.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, format, contentText: content },
        update: { format, contentText: content, updatedAt: new Date() },
      });
      return reply.send({ ok: true });
    }
  );

  // --- Suggest config from stored spec ---
  fastify.get(
    '/integrations/kiteprop/spec/suggest',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string' },
              leadCreatePath: { type: 'string' },
              authHeaderName: { type: 'string' },
              authFormat: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const spec = await prisma.kitepropOpenApiSpec.findFirst({
        where: { userId: user.userId },
      });
      if (!spec) {
        return reply.send({
          baseUrl: '',
          leadCreatePath: '',
          authHeaderName: '',
          authFormat: '',
        });
      }
      const config = parseKitepropOpenAPIFromContent(spec.contentText);
      if (!config) {
        return reply.send({
          baseUrl: '',
          leadCreatePath: '',
          authHeaderName: '',
          authFormat: '',
        });
      }
      return reply.send({
        baseUrl: config.baseUrl,
        leadCreatePath: config.leadCreatePath,
        authHeaderName: config.authHeaderName,
        authFormat: config.authFormat,
      });
    }
  );

  // --- Suggest payload template from stored spec ---
  fastify.get(
    '/integrations/kiteprop/spec/suggest-template',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { template: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const spec = await prisma.kitepropOpenApiSpec.findFirst({
        where: { userId: user.userId },
      });
      if (!spec) {
        return reply.send({ template: '{}' });
      }
      const template = suggestTemplateFromSpec(spec.contentText);
      return reply.send({ template });
    }
  );

  // --- Últimos envíos Kiteprop (para UI) ---
  fastify.get(
    '/integrations/kiteprop/attempts',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { limit: { type: 'number' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              attempts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    leadId: { type: 'string' },
                    listingTitle: { type: 'string' },
                    status: { type: 'string' },
                    httpStatus: { type: 'number', nullable: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const limit = Math.min(Number((request.query as { limit?: number }).limit) || 10, 50);
      const attempts = await prisma.leadDeliveryAttempt.findMany({
        where: {
          kind: LeadDeliveryAttemptKind.KITEPROP,
          lead: { userId: user.userId },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          lead: {
            include: {
              listing: { select: { title: true } },
            },
          },
        },
      });
      return reply.send({
        attempts: attempts.map((a) => ({
          id: a.id,
          leadId: a.leadId,
          listingTitle: a.lead.listing?.title ?? '',
          status: a.status,
          httpStatus: a.httpStatus,
          createdAt: a.createdAt.toISOString(),
        })),
      });
    }
  );

  // --- Reintentar envío de un lead ---
  fastify.post(
    '/integrations/kiteprop/retry',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['leadId'],
          properties: { leadId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              httpStatus: { type: 'number', nullable: true },
              snippet: { type: 'string' },
              userMessage: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { leadId } = request.body as { leadId: string };
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId: user.userId },
        include: {
          listing: true,
          user: { select: { email: true } },
          publisher: { select: { orgId: true } },
        },
      });
      if (!lead) {
        throw fastify.httpErrors.notFound('Lead not found');
      }
      const result = await deliverToKiteprop(lead as Parameters<typeof deliverToKiteprop>[0], {
        testMode: false,
      });
      const userMessage = kitepropUserMessage(result.httpStatus ?? 0, result.snippet ?? '');
      return reply.send({
        ok: result.ok,
        httpStatus: result.httpStatus ?? null,
        snippet: result.snippet ?? '',
        userMessage,
      });
    }
  );

  // --- Reintentar último lead fallido ---
  fastify.post(
    '/integrations/kiteprop/retry-last-failed',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              leadId: { type: 'string', nullable: true },
              httpStatus: { type: 'number', nullable: true },
              snippet: { type: 'string' },
              userMessage: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const lastFailed = await prisma.leadDeliveryAttempt.findFirst({
        where: {
          kind: LeadDeliveryAttemptKind.KITEPROP,
          status: LeadDeliveryAttemptStatus.FAIL,
          lead: { userId: user.userId },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            include: {
              listing: true,
              user: { select: { email: true } },
              publisher: { select: { orgId: true } },
            },
          },
        },
      });
      if (!lastFailed?.lead) {
        return reply.send({
          ok: false,
          leadId: null,
          httpStatus: null,
          snippet: 'No failed KITEPROP delivery found',
          userMessage: 'No hay envíos fallidos para reintentar.',
        });
      }
      const lead = lastFailed.lead;
      const result = await deliverToKiteprop(lead as Parameters<typeof deliverToKiteprop>[0], {
        testMode: false,
      });
      const userMessage = kitepropUserMessage(result.httpStatus ?? 0, result.snippet ?? '');
      return reply.send({
        ok: result.ok,
        leadId: lead.id,
        httpStatus: result.httpStatus ?? null,
        snippet: result.snippet ?? '',
        userMessage,
      });
    }
  );
}
