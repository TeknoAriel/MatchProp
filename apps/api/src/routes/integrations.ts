import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
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
  fastify.addHook('preHandler', fastify.requireRole([UserRole.ADMIN]));

  const defaultConfig = parseKitepropOpenAPI();

  // --- SendGrid (Magic Link) - config desde settings, habilitar en prod ---

  fastify.get(
    '/integrations/sendgrid',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              isEnabled: { type: 'boolean' },
              hasApiKey: { type: 'boolean' },
              fromEmail: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async () => {
      const row = await prisma.sendGridConfig.findUnique({
        where: { id: 'default' },
      });
      return {
        isEnabled: row?.isEnabled ?? false,
        hasApiKey: !!row?.apiKeyEncrypted,
        fromEmail: row?.fromEmail ?? 'noreply@matchprop.com',
      };
    }
  );

  fastify.put(
    '/integrations/sendgrid',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
            fromEmail: { type: 'string' },
            isEnabled: { type: 'boolean' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const body = request.body as { apiKey?: string; fromEmail?: string; isEnabled?: boolean };
      const masterKey = process.env.INTEGRATIONS_MASTER_KEY;
      if (body.apiKey && !masterKey) {
        throw fastify.httpErrors.preconditionFailed(
          'INTEGRATIONS_MASTER_KEY no configurado. Necesario para cifrar la API key.'
        );
      }
      const fromEmail = body.fromEmail?.trim() || 'noreply@matchprop.com';
      const isEnabled = body.isEnabled ?? false;
      const existing = await prisma.sendGridConfig.findUnique({ where: { id: 'default' } });
      const apiKeyEncrypted = body.apiKey
        ? encrypt(body.apiKey)
        : (existing?.apiKeyEncrypted ?? null);

      await prisma.sendGridConfig.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          apiKeyEncrypted,
          fromEmail,
          isEnabled,
        },
        update: {
          apiKeyEncrypted,
          fromEmail,
          isEnabled,
        },
      });
      return { ok: true };
    }
  );

  // --- Asistente IA (usuario, contraseña, apiKey, token para LLM) ---

  fastify.get(
    '/integrations/assistant',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hasApiKey: { type: 'boolean' },
              hasUsername: { type: 'boolean' },
              hasPassword: { type: 'boolean' },
              hasToken: { type: 'boolean' },
              provider: { type: 'string', nullable: true },
              username: { type: 'string', nullable: true },
              model: { type: 'string', nullable: true },
              conversationalModel: { type: 'string', nullable: true },
              baseUrl: { type: 'string', nullable: true },
              isEnabled: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => {
      const row = await prisma.assistantConfig.findUnique({ where: { id: 'default' } });
      return {
        hasApiKey: !!row?.apiKeyEncrypted,
        hasUsername: !!row?.username,
        hasPassword: !!row?.passwordEncrypted,
        hasToken: !!row?.tokenEncrypted,
        provider: row?.provider ?? null,
        username: row?.username ?? null,
        model: row?.model ?? null,
        conversationalModel: row?.conversationalModel ?? null,
        baseUrl: row?.baseUrl ?? null,
        isEnabled: row?.isEnabled ?? false,
      };
    }
  );

  fastify.put(
    '/integrations/assistant',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            apiKey: { type: 'string' },
            token: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            conversationalModel: { type: 'string' },
            baseUrl: { type: 'string' },
            isEnabled: { type: 'boolean' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const body = request.body as {
        username?: string;
        password?: string;
        apiKey?: string;
        token?: string;
        provider?: string;
        model?: string;
        conversationalModel?: string;
        baseUrl?: string;
        isEnabled?: boolean;
      };
      const masterKey = process.env.INTEGRATIONS_MASTER_KEY;
      const needsEncrypt = body.apiKey || body.password || body.token;
      if (needsEncrypt && !masterKey) {
        throw fastify.httpErrors.preconditionFailed(
          'INTEGRATIONS_MASTER_KEY no configurado para cifrar credenciales.'
        );
      }
      const existing = await prisma.assistantConfig.findUnique({ where: { id: 'default' } });
      const apiKeyEncrypted = body.apiKey
        ? encrypt(body.apiKey)
        : (existing?.apiKeyEncrypted ?? null);
      const passwordEncrypted = body.password
        ? encrypt(body.password)
        : (existing?.passwordEncrypted ?? null);
      const tokenEncrypted = body.token ? encrypt(body.token) : (existing?.tokenEncrypted ?? null);

      await prisma.assistantConfig.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          provider: body.provider ?? null,
          username: body.username?.trim() || null,
          passwordEncrypted,
          apiKeyEncrypted,
          tokenEncrypted,
          model: body.model ?? null,
          baseUrl: body.baseUrl ?? null,
          conversationalModel: body.conversationalModel ?? null,
          isEnabled: body.isEnabled ?? false,
        },
        update: {
          ...(body.provider !== undefined && { provider: body.provider }),
          ...(body.username !== undefined && { username: body.username?.trim() || null }),
          ...(passwordEncrypted !== undefined && { passwordEncrypted }),
          ...(apiKeyEncrypted !== undefined && { apiKeyEncrypted }),
          ...(tokenEncrypted !== undefined && { tokenEncrypted }),
          ...(body.model !== undefined && { model: body.model }),
          ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl }),
          ...(body.conversationalModel !== undefined && {
            conversationalModel: body.conversationalModel,
          }),
          ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
        },
      });
      return { ok: true };
    }
  );

  // --- API Universal (status: env API_UNIVERSAL_KEY) ---

  fastify.get(
    '/integrations/api-universal-status',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              configured: { type: 'boolean' },
              baseUrl: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async () => {
      const keys = (process.env.API_UNIVERSAL_KEY ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        configured: keys.length > 0,
        baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
      };
    }
  );

  // --- Pasarela de pago (Stripe: env STRIPE_*) ---

  fastify.get(
    '/integrations/payments-status',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              stripeConfigured: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => {
      const hasKey = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 0);
      return { stripeConfigured: hasKey };
    }
  );

  // --- Importadores (fuentes Kiteprop difusiones: properstar, zonaprop, externalsite) ---

  fastify.get(
    '/integrations/importers',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              sourcesJson: { type: 'object' },
            },
          },
        },
      },
    },
    async () => {
      const row = await prisma.ingestSourceConfig.findUnique({
        where: { id: 'default' },
      });
      const sourcesJson = (row?.sourcesJson as Record<string, unknown>) ?? {};
      return { sourcesJson };
    }
  );

  fastify.put(
    '/integrations/importers',
    {
      schema: {
        tags: ['Integrations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            sourcesJson: { type: 'object' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const body = request.body as { sourcesJson?: Record<string, unknown> };
      const sourcesJson = (body.sourcesJson ?? {}) as object;
      await prisma.ingestSourceConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', sourcesJson },
        update: { sourcesJson },
      });
      return { ok: true };
    }
  );

  // --- Kiteprop ---

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
