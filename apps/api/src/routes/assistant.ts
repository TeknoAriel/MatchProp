import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { interpretSearchQuery, loadIntentLlmConfig } from '../services/assistant/search-interpreter.js';
import { chatCompletion } from '../services/assistant/conversational.js';
import { normalizeFilters, searchFiltersSchema } from '../schemas/search.js';
import { executeFeed } from '../lib/feed-engine.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { reorderByEngagementAffinity } from '../services/assistant/preview-affinity.js';
import { reorderBySoftSignals } from '../services/assistant/preview-soft-rank.js';
import type { SearchFilters } from '@matchprop/shared';

const PREVIEW_LIMIT = 10;

const assistantSearchBodySchema = z.object({
  text: z.string().min(3, 'Mínimo 3 caracteres').max(500, 'Máximo 500 caracteres'),
  previousFilters: searchFiltersSchema.optional(),
  previousQuery: z.string().max(500).optional(),
});

export type FallbackMode = 'STRICT' | 'RELAX' | 'BROAD' | 'FEED';

/** Relaja números y quita filtros muy restrictivos; mantiene tipo, zona, amenities y texto. */
export function relaxFilters(f: SearchFilters): SearchFilters {
  const next: SearchFilters = {
    operationType: f.operationType,
    currency: f.currency,
    propertyType: f.propertyType,
    locationText: f.locationText,
    addressText: f.addressText,
    titleContains: f.titleContains,
    descriptionContains: f.descriptionContains,
    keywords: f.keywords,
    amenities: f.amenities,
    aptoCredito: f.aptoCredito,
    source: f.source,
    sortBy: f.sortBy,
    minLat: f.minLat,
    maxLat: f.maxLat,
    minLng: f.minLng,
    maxLng: f.maxLng,
  };
  if (f.priceMin != null) next.priceMin = f.priceMin;
  if (f.priceMax != null) next.priceMax = f.priceMax;
  if (f.bathroomsMin != null) next.bathroomsMin = f.bathroomsMin;
  if (f.bathroomsMax != null) next.bathroomsMax = f.bathroomsMax;
  if (f.bedroomsMin != null) {
    next.bedroomsMin = f.bedroomsMin <= 1 ? 0 : f.bedroomsMin - 1;
  }
  if (f.bedroomsMax != null) next.bedroomsMax = f.bedroomsMax + 1;
  return next;
}

/** Misma zona + tipo + operación (y moneda si hay); sin precio/dorm/superficie. Opcional: amenities si no hay tipo. */
export function broadSearchFilters(f: SearchFilters): SearchFilters {
  const next: SearchFilters = {};
  if (f.operationType) next.operationType = f.operationType;
  if (f.currency) next.currency = f.currency;
  if (f.propertyType?.length) next.propertyType = [...f.propertyType];
  const loc = f.locationText?.trim();
  if (loc) next.locationText = loc;
  if (!next.propertyType?.length && !loc && f.amenities?.length) {
    next.amenities = [...f.amenities];
  }
  return next;
}

export async function assistantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/search',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Assistant'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 3, maxLength: 500 },
            previousFilters: { type: 'object', additionalProperties: true },
            previousQuery: { type: 'string', maxLength: 500 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              filters: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  operationType: { type: 'string' },
                  propertyType: { type: 'array', items: { type: 'string' } },
                  priceMin: { type: 'number' },
                  priceMax: { type: 'number' },
                  bedroomsMin: { type: 'integer' },
                  bathroomsMin: { type: 'integer' },
                  areaMin: { type: 'integer' },
                  locationText: { type: 'string' },
                  currency: { type: 'string' },
                  keywords: { type: 'array', items: { type: 'string' } },
                },
              },
              explanation: { type: 'string' },
              warnings: { type: 'array', items: { type: 'string' } },
              intent: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const parsed = assistantSearchBodySchema.safeParse((request.body as object) ?? {});
        if (!parsed.success) {
          return reply.status(400).send({
            message: parsed.error.errors[0]?.message ?? 'Invalid request',
            code: 'INVALID_REQUEST',
          });
        }
        const { text, previousFilters: prevRaw, previousQuery: _prevQ } = parsed.data;
        void _prevQ;

        // No loguear texto completo (PII). Solo longitud.
        request.log.info(
          { textLen: text.length, hasPrevious: !!prevRaw },
          'assistant/search'
        );

        let result;
        try {
          const previousFilters = prevRaw
            ? (normalizeFilters(prevRaw) as SearchFilters)
            : undefined;
          const llm = await loadIntentLlmConfig();
          result = await interpretSearchQuery({ text, previousFilters, llm });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes('assistant_search_inconsistent') &&
            process.env.NODE_ENV !== 'production'
          ) {
            request.log.error({ err, textLen: text.length }, 'assistant/search inconsistent');
            return reply.status(500).send({
              message: 'assistant_search_inconsistent',
              code: 'ASSISTANT_INCONSISTENT',
            });
          }
          request.log.error({ err, textLen: text.length }, 'assistant/search parse error');
          return reply.status(500).send({
            message: 'Error al interpretar la búsqueda. Probá de nuevo.',
            code: 'ASSISTANT_ERROR',
          });
        }

        return {
          filters: result.filters,
          explanation: result.explanation,
          warnings: result.warnings ?? [],
          intent: result.intent,
        };
      } catch (err) {
        request.log.error({ err }, 'assistant/search unhandled');
        return reply.status(500).send({
          message: 'Error al buscar. Probá de nuevo en un momento.',
          code: 'SERVER_ERROR',
        });
      }
    }
  );

  fastify.post(
    '/preview',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Assistant'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['filters'],
          properties: {
            filters: { type: 'object' },
            cursor: { type: 'string' },
            limit: { type: 'integer' },
            fallbackMode: { type: 'string', enum: ['STRICT', 'RELAX', 'BROAD', 'FEED'] },
            softPreferences: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { type: 'object' } },
              nextCursor: { type: ['string', 'null'] },
              limit: { type: 'integer' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as {
        filters?: unknown;
        cursor?: string;
        limit?: number;
        fallbackMode?: FallbackMode;
        softPreferences?: string[];
      };
      const rawFilters = normalizeFilters(body.filters ?? {}) as SearchFilters;
      const limit = Math.min(20, Math.max(1, body.limit ?? PREVIEW_LIMIT));
      const cursor = body.cursor ?? null;
      const mode = body.fallbackMode ?? 'STRICT';

      let filters: SearchFilters;
      if (mode === 'FEED') {
        filters = {};
      } else if (mode === 'RELAX') {
        filters = relaxFilters(rawFilters);
      } else if (mode === 'BROAD') {
        filters = broadSearchFilters(rawFilters);
      } else {
        filters = rawFilters;
      }

      let result = await executeFeed({
        userId: user.userId,
        limit,
        cursor,
        includeTotal: false,
        filters,
        excludeSwipes: true,
      });

      // Si FEED devuelve vacío, intentar incluir ya vistos como ejemplos
      if (
        mode === 'FEED' &&
        result.items?.length === 0 &&
        !cursor &&
        result.error !== 'INVALID_CURSOR'
      ) {
        const fallback = await executeFeed({
          userId: user.userId,
          limit,
          cursor: null,
          includeTotal: false,
          filters,
          excludeSwipes: false,
        });
        if ((fallback.items?.length ?? 0) > 0) result = fallback;
      }

      if (result.error === 'INVALID_CURSOR') {
        return reply.status(400).send({
          message: 'Cursor inválido',
          code: 'INVALID_CURSOR',
        });
      }

      const feedResult = result as {
        items: { id: string; propertyType?: string | null }[];
        nextCursor: string | null;
        limit: number;
      };

      let itemsOut = feedResult.items;
      const softPrefs = Array.isArray(body.softPreferences)
        ? body.softPreferences.filter((s) => typeof s === 'string' && s.trim()).slice(0, 20)
        : [];
      if (!cursor && mode !== 'FEED' && Array.isArray(itemsOut) && itemsOut.length > 1) {
        itemsOut = await reorderByEngagementAffinity(user.userId, itemsOut);
        itemsOut = reorderBySoftSignals(itemsOut, softPrefs);
      }

      return {
        items: itemsOut,
        nextCursor: feedResult.nextCursor,
        limit: feedResult.limit,
      };
    }
  );

  // --- Asistente conversacional: listo para conectar cualquier modelo (OpenAI, Claude, etc.) ---
  fastify.post(
    '/chat',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Assistant'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 1, maxLength: 2000 },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: { role: { type: 'string' }, content: { type: 'string' } },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              model: { type: 'string', nullable: true },
              configured: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { message, history = [] } = (request.body ?? {}) as {
        message?: string;
        history?: { role: string; content: string }[];
      };
      const config = await prisma.assistantConfig.findUnique({ where: { id: 'default' } });

      const hasAuth = config?.apiKeyEncrypted || config?.tokenEncrypted;
      if (!config?.isEnabled || !hasAuth) {
        return reply.send({
          reply:
            'Conectá un modelo en Configuración → Asistente IA: completá API key o Token (y usuario/contraseña si aplica).',
          model: null,
          configured: false,
        });
      }

      const modelId = config.conversationalModel ?? config.model ?? config.provider ?? 'unknown';
      const provider = (config.provider ?? 'openai') as 'openai' | 'anthropic' | 'azure' | 'custom';

      let apiKey: string;
      try {
        apiKey = config.apiKeyEncrypted
          ? decrypt(config.apiKeyEncrypted)
          : config.tokenEncrypted
            ? decrypt(config.tokenEncrypted)
            : '';
      } catch {
        return reply.send({
          reply: 'Error al descifrar credenciales. Verificá INTEGRATIONS_MASTER_KEY.',
          model: null,
          configured: false,
        });
      }
      if (!apiKey?.trim()) {
        return reply.send({
          reply: 'API key o Token vacío. Configurá en Asistente IA.',
          model: null,
          configured: false,
        });
      }

      const result = await chatCompletion(
        {
          provider,
          apiKey,
          model: modelId,
          baseUrl: config.baseUrl,
        },
        message ?? '',
        history.map((h) => ({
          role: h.role as 'user' | 'assistant' | 'system',
          content: h.content,
        }))
      );

      if (result.error) {
        request.log.warn({ err: result.error, model: modelId }, 'assistant/chat LLM error');
        return reply.send({
          reply: `Error del proveedor: ${result.error}`,
          model: modelId,
          configured: true,
        });
      }

      return reply.send({
        reply: result.reply,
        model: result.model,
        configured: true,
      });
    }
  );
}
