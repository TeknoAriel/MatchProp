import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { SavedListType } from '@prisma/client';

type ListingMediaOut = { url: string; sortOrder: number };

function pickImageUrl(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const candidates = [o.url, o.src, o.image, o.photo, o.thumbnail, o.original];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
  }
  return null;
}

function mediaFromRawJson(rawJson: unknown): ListingMediaOut[] {
  if (!rawJson || typeof rawJson !== 'object') return [];
  const raw = rawJson as Record<string, unknown>;
  const arrays = [raw.media, raw.images, raw.photos, raw.fotos];
  const out: ListingMediaOut[] = [];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const url = pickImageUrl(item);
      if (!url) continue;
      out.push({ url, sortOrder: out.length });
    }
    if (out.length > 0) return out;
  }
  return out;
}

function heroFromRawJson(rawJson: unknown): string | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const raw = rawJson as Record<string, unknown>;
  const candidates = [raw.heroImageUrl, raw.image, raw.cover, raw.portada];
  for (const c of candidates) {
    const url = pickImageUrl(c);
    if (url) return url;
  }
  return null;
}

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
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              currency: true,
              locationText: true,
              heroImageUrl: true,
              source: true,
              bedrooms: true,
              bathrooms: true,
              areaTotal: true,
              propertyType: true,
              operationType: true,
              rawJson: true,
              media: {
                orderBy: { sortOrder: 'asc' },
                select: { url: true, sortOrder: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        items: items.map((s) => {
          const listing = s.listing;
          if (!listing)
            return { id: s.id, listingId: s.listingId, listType: s.listType, listing: null };
          const fallbackMedia = mediaFromRawJson(listing.rawJson);
          const media = listing.media?.length ? listing.media : fallbackMedia;
          const heroImageUrl =
            listing.heroImageUrl ?? media?.[0]?.url ?? heroFromRawJson(listing.rawJson) ?? null;
          return {
            id: s.id,
            listingId: s.listingId,
            listType: s.listType,
            listing: {
              ...listing,
              heroImageUrl,
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
