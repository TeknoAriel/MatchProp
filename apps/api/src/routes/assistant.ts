import { FastifyInstance } from 'fastify';
import { getAssistantProvider } from '../services/assistant/index.js';
import { assistantSearchRequestSchema, normalizeFilters } from '../schemas/search.js';
import { executeFeed } from '../lib/feed-engine.js';
import type { SearchFilters } from '@matchprop/shared';

const PREVIEW_LIMIT = 10;

export type FallbackMode = 'STRICT' | 'RELAX' | 'FEED';

function relaxFilters(f: SearchFilters): SearchFilters {
  const next: SearchFilters = {};
  if (f.operationType) next.operationType = f.operationType;
  if (f.currency) next.currency = f.currency;
  if (f.priceMin != null) next.priceMin = f.priceMin;
  if (f.priceMax != null) next.priceMax = f.priceMax;
  if (f.bathroomsMin != null) next.bathroomsMin = f.bathroomsMin;
  if (f.areaMin != null) next.areaMin = f.areaMin;
  if (f.bedroomsMin != null && f.bedroomsMin > 1) next.bedroomsMin = Math.max(0, f.bedroomsMin - 1);
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
      const parsed = assistantSearchRequestSchema.safeParse(
        (request.body as { text?: string }) ?? {}
      );
      if (!parsed.success) {
        return reply.status(400).send({
          message: parsed.error.errors[0]?.message ?? 'Invalid request',
          code: 'INVALID_REQUEST',
        });
      }
      const { text } = parsed.data;

      // No loguear texto completo (PII). Solo longitud.
      request.log.info({ textLen: text.length }, 'assistant/search');

      const provider = getAssistantProvider();
      let result;
      try {
        result = await provider.parse(text);
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
        throw err;
      }

      return {
        filters: result.filters,
        explanation: result.explanation,
        warnings: result.warnings ?? [],
      };
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
            fallbackMode: { type: 'string', enum: ['STRICT', 'RELAX', 'FEED'] },
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

      return {
        items: result.items,
        nextCursor: result.nextCursor,
        limit: result.limit,
      };
    }
  );
}
