import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { envFlag } from '../config.js';

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

const listingSelect = {
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
} as const;

export async function listsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/me/lists',
    {
      schema: {
        tags: ['Lists'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true, premiumUntil: true },
      });
      if (!dbUser) throw fastify.httpErrors.unauthorized();
      const isDemo = envFlag('DEMO_MODE');
      const premiumFree =
        isDemo ||
        envFlag('PREMIUM_FREE') ||
        envFlag('PREMIUM_GRACE_PERIOD') ||
        process.env.NODE_ENV === 'development';
      const simPremium =
        (process.env.NODE_ENV === 'development' || envFlag('DEMO_MODE')) &&
        ((request.cookies as Record<string, string> | undefined)?.['matchprop_premium_sim'] ===
          '1' ||
          (request.headers['x-premium-sim'] as string) === '1');
      const isPremium =
        premiumFree || !!(dbUser.premiumUntil && dbUser.premiumUntil > new Date()) || !!simPremium;
      // En modo demo dejamos crear listas siempre, sin exigir rol ni premium real.
      const canCreateLists =
        isDemo ||
        (isPremium &&
          (premiumFree
            ? true
            : ['AGENT', 'REALTOR', 'INMOBILIARIA', 'ADMIN'].includes(dbUser.role)));
      if (!canCreateLists) {
        throw fastify.httpErrors.forbidden(
          'Necesitás plan Agente o superior para crear listas personalizadas. Usuario (1 USD) solo puede usar Like y Favoritos.'
        );
      }
      const body = request.body as { name: string };
      const name = body.name.trim();
      if (!name) throw fastify.httpErrors.badRequest('El nombre no puede estar vacío');

      const list = await prisma.savedList.create({
        data: { userId: user.userId, name },
      });

      return reply.status(201).send({
        id: list.id,
        name: list.name,
        createdAt: list.createdAt.toISOString(),
      });
    }
  );

  fastify.get(
    '/me/lists',
    {
      schema: {
        tags: ['Lists'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              lists: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    createdAt: { type: 'string' },
                    count: { type: 'number' },
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

      const lists = await prisma.savedList.findMany({
        where: { userId: user.userId },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        lists: lists.map((l) => ({
          id: l.id,
          name: l.name,
          createdAt: l.createdAt.toISOString(),
          count: l._count.items,
        })),
      };
    }
  );

  fastify.post(
    '/me/lists/:id/items',
    {
      schema: {
        tags: ['Lists'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['listingId'],
          properties: { listingId: { type: 'string' } },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              savedListId: { type: 'string' },
              listingId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: savedListId } = request.params as { id: string };
      const body = request.body as { listingId: string };

      const list = await prisma.savedList.findFirst({
        where: { id: savedListId, userId: user.userId },
      });
      if (!list) throw fastify.httpErrors.notFound('Lista no encontrada');

      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      const item = await prisma.savedListItem.upsert({
        where: {
          savedListId_listingId: { savedListId, listingId: body.listingId },
        },
        create: { savedListId, listingId: body.listingId },
        update: {},
      });

      return reply.status(201).send({
        id: item.id,
        savedListId: item.savedListId,
        listingId: item.listingId,
      });
    }
  );

  fastify.get(
    '/me/lists/:id/items',
    {
      schema: {
        tags: ['Lists'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              list: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    listingId: { type: 'string' },
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
      const { id } = request.params as { id: string };

      const list = await prisma.savedList.findFirst({
        where: { id, userId: user.userId },
        include: {
          items: {
            include: { listing: { select: listingSelect } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!list) throw fastify.httpErrors.notFound('Lista no encontrada');

      return {
        list: { id: list.id, name: list.name },
        items: list.items.map((i) => {
          const listing = i.listing;
          const fallbackMedia = listing ? mediaFromRawJson(listing.rawJson) : [];
          const media = listing ? (listing.media?.length ? listing.media : fallbackMedia) : [];
          const heroImageUrl = listing
            ? (listing.heroImageUrl ?? media?.[0]?.url ?? heroFromRawJson(listing.rawJson) ?? null)
            : null;
          return {
            id: i.id,
            listingId: i.listingId,
            listing: listing ? { ...listing, heroImageUrl, media } : null,
          };
        }),
      };
    }
  );

  fastify.delete(
    '/me/lists/:listId/items/:listingId',
    {
      schema: {
        tags: ['Lists'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['listId', 'listingId'],
          properties: { listId: { type: 'string' }, listingId: { type: 'string' } },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const { listId, listingId } = request.params as { listId: string; listingId: string };

      const list = await prisma.savedList.findFirst({
        where: { id: listId, userId: user.userId },
      });
      if (!list) throw fastify.httpErrors.notFound('Lista no encontrada');

      await prisma.savedListItem.deleteMany({
        where: { savedListId: listId, listingId },
      });
      return { ok: true };
    }
  );
}
