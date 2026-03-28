import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { SavedListType } from '@prisma/client';
import { extractFromRawJson } from '../lib/rawjson-fallback.js';

export async function savedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/saved',
    {
      schema: {
        tags: ['Saved'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['listingId', 'listType'],
          properties: {
            listingId: { type: 'string' },
            listType: { type: 'string', enum: ['FAVORITE', 'LATER'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              listType: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { listingId: string; listType: string };

      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      const listType = body.listType === 'LATER' ? SavedListType.LATER : SavedListType.FAVORITE;

      const saved = await prisma.savedItem.upsert({
        where: {
          userId_listingId_listType: {
            userId: user.userId,
            listingId: body.listingId,
            listType,
          },
        },
        create: {
          userId: user.userId,
          listingId: body.listingId,
          listType,
        },
        update: {},
      });

      return reply.status(201).send({
        id: saved.id,
        listType: saved.listType,
      });
    }
  );

  fastify.get(
    '/me/saved',
    {
      schema: {
        tags: ['Saved'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            listType: { type: 'string', enum: ['FAVORITE', 'LATER'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    listingId: { type: 'string' },
                    listType: { type: 'string' },
                    savedAt: { type: 'string' },
                    listing: { type: 'object' },
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
      const query = request.query as { listType?: string };

      const where: { userId: string; listType?: SavedListType } = {
        userId: user.userId,
      };
      if (query.listType) {
        where.listType = query.listType === 'LATER' ? SavedListType.LATER : SavedListType.FAVORITE;
      }

      const items = await prisma.savedItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // Hidratar listings por lote (más robusto que depender de include/relación).
      const listingIds = Array.from(new Set(items.map((i) => i.listingId).filter(Boolean)));
      const listings =
        listingIds.length > 0
          ? await prisma.listing.findMany({
              where: { id: { in: listingIds } },
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
                locationText: true,
                heroImageUrl: true,
                rawJson: true,
                source: true,
                bedrooms: true,
                bathrooms: true,
                areaTotal: true,
                propertyType: true,
                operationType: true,
                media: {
                  orderBy: { sortOrder: 'asc' },
                  select: { url: true, sortOrder: true },
                },
              },
            })
          : [];
      const listingById = new Map(listings.map((l) => [l.id, l]));

      return {
        items: items.map((s) => {
          const listing = listingById.get(s.listingId) ?? null;
          if (!listing)
            return { id: s.id, listingId: s.listingId, listType: s.listType, listing: null };
          let heroImageUrl = listing.heroImageUrl ?? listing.media?.[0]?.url ?? null;
          let title = listing.title;
          let media = listing.media;
          if ((!heroImageUrl || !title?.trim()) && listing.rawJson) {
            const fallback = extractFromRawJson(listing.rawJson);
            if (!heroImageUrl) heroImageUrl = fallback.heroImageUrl;
            if (!title?.trim()) title = fallback.title;
            if (!media?.length && fallback.mediaUrls.length) {
              media = fallback.mediaUrls.map((m) => ({ url: m.url, sortOrder: m.sortOrder }));
            }
          }
          return {
            id: s.id,
            listingId: s.listingId,
            listType: s.listType,
            savedAt: s.createdAt.toISOString(),
            listing: {
              ...listing,
              rawJson: undefined,
              heroImageUrl,
              title,
              media,
            },
          };
        }),
      };
    }
  );

  fastify.delete(
    '/me/saved/:listingId',
    {
      schema: {
        tags: ['Saved'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['listingId'],
          properties: { listingId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: { listType: { type: 'string', enum: ['FAVORITE', 'LATER'] } },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const { listingId } = request.params as { listingId: string };
      const query = request.query as { listType?: string };
      const listType = query.listType === 'LATER' ? SavedListType.LATER : SavedListType.FAVORITE;

      await prisma.savedItem.deleteMany({
        where: {
          userId: user.userId,
          listingId,
          listType,
        },
      });
      return { ok: true };
    }
  );
}
