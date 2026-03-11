import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function listingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get(
    '/listings/:id',
    {
      schema: {
        tags: ['Listings'],
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
              id: { type: 'string' },
              source: { type: 'string' },
              externalId: { type: 'string' },
              title: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              operationType: { type: ['string', 'null'] },
              propertyType: { type: ['string', 'null'] },
              price: { type: ['number', 'null'] },
              currency: { type: ['string', 'null'] },
              bedrooms: { type: ['integer', 'null'] },
              bathrooms: { type: ['integer', 'null'] },
              areaTotal: { type: ['number', 'null'] },
              areaCovered: { type: ['number', 'null'] },
              lat: { type: ['number', 'null'] },
              lng: { type: ['number', 'null'] },
              addressText: { type: ['string', 'null'] },
              locationText: { type: ['string', 'null'] },
              heroImageUrl: { type: ['string', 'null'] },
              photosCount: { type: 'integer' },
              details: { type: ['object', 'null'] },
              media: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { url: { type: 'string' }, sortOrder: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const { id } = request.params as { id: string };

      const listing = await prisma.listing.findUnique({
        where: { id, status: 'ACTIVE' },
        include: {
          media: { orderBy: { sortOrder: 'asc' } },
        },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      const mediaList = listing.media.map((m) => ({ url: m.url, sortOrder: m.sortOrder }));
      const photosCount = mediaList.length || (listing.heroImageUrl ? 1 : 0);
      const details =
        listing.details != null && typeof listing.details === 'object'
          ? (listing.details as object)
          : null;

      return {
        id: listing.id,
        source: listing.source,
        externalId: listing.externalId,
        title: listing.title,
        description: listing.description,
        operationType: listing.operationType,
        propertyType: listing.propertyType,
        price: listing.price,
        currency: listing.currency,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        areaTotal: listing.areaTotal,
        areaCovered: listing.areaCovered,
        lat: listing.lat,
        lng: listing.lng,
        addressText: listing.addressText,
        locationText: listing.locationText,
        heroImageUrl: listing.heroImageUrl,
        photosCount,
        details,
        media: mediaList,
      };
    }
  );

  fastify.get(
    '/listings/:id/match-summary',
    {
      schema: {
        tags: ['Listings'],
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
              matchesCount: { type: 'integer' },
              topSearchIds: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      const last = await prisma.crmPushOutbox.findFirst({
        where: { listingId: id },
        orderBy: { createdAt: 'desc' },
        select: { matchesCount: true, topSearchIds: true },
      });
      return {
        matchesCount: last?.matchesCount ?? 0,
        topSearchIds: (last?.topSearchIds as string[]) ?? [],
      };
    }
  );

  fastify.get(
    '/listings/:id/my-status',
    {
      schema: {
        tags: ['Listings'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              inFavorite: { type: 'boolean' },
              inLike: { type: 'boolean' },
              inLists: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { id: { type: 'string' }, name: { type: 'string' } },
                },
              },
              lead: {
                type: ['object', 'null'],
                properties: { status: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const { id: listingId } = request.params as { id: string };

      const [savedFavorite, savedLike, savedListItems, lead] = await Promise.all([
        prisma.savedItem.findUnique({
          where: {
            userId_listingId_listType: {
              userId: user.userId,
              listingId,
              listType: 'FAVORITE',
            },
          },
        }),
        prisma.savedItem.findUnique({
          where: {
            userId_listingId_listType: {
              userId: user.userId,
              listingId,
              listType: 'LATER',
            },
          },
        }),
        prisma.savedListItem.findMany({
          where: {
            listingId,
            savedList: { userId: user.userId },
          },
          include: { savedList: { select: { id: true, name: true } } },
        }),
        prisma.lead.findFirst({
          where: { userId: user.userId, listingId },
          select: { status: true },
        }),
      ]);

      return {
        inFavorite: !!savedFavorite,
        inLike: !!savedLike,
        inLists: savedListItems.map((i) => ({ id: i.savedList.id, name: i.savedList.name })),
        lead: lead ? { status: lead.status } : null,
      };
    }
  );

  fastify.get(
    '/listings/my-status-bulk',
    {
      schema: {
        tags: ['Listings'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['ids'],
          properties: { ids: { type: 'string', description: 'Comma-separated listing IDs' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    inFavorite: { type: 'boolean' },
                    inLike: { type: 'boolean' },
                    inLists: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' }, name: { type: 'string' } },
                      },
                    },
                    lead: { type: ['object', 'null'], properties: { status: { type: 'string' } } },
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
      const idsRaw = (request.query as { ids?: string }).ids ?? '';
      const listingIds = idsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      if (listingIds.length === 0) return { items: {} };

      const [savedFavorites, savedLikes, savedListItems, leads] = await Promise.all([
        prisma.savedItem.findMany({
          where: { userId: user.userId, listingId: { in: listingIds }, listType: 'FAVORITE' },
          select: { listingId: true },
        }),
        prisma.savedItem.findMany({
          where: { userId: user.userId, listingId: { in: listingIds }, listType: 'LATER' },
          select: { listingId: true },
        }),
        prisma.savedListItem.findMany({
          where: { listingId: { in: listingIds }, savedList: { userId: user.userId } },
          include: { savedList: { select: { id: true, name: true } } },
        }),
        prisma.lead.findMany({
          where: { userId: user.userId, listingId: { in: listingIds } },
          select: { listingId: true, status: true },
        }),
      ]);

      const inFavoriteSet = new Set(savedFavorites.map((s) => s.listingId));
      const inLikeSet = new Set(savedLikes.map((s) => s.listingId));
      const inListsByListing = new Map<string, { id: string; name: string }[]>();
      for (const i of savedListItems) {
        const arr = inListsByListing.get(i.listingId) ?? [];
        arr.push({ id: i.savedList.id, name: i.savedList.name });
        inListsByListing.set(i.listingId, arr);
      }
      const leadByListing = new Map(leads.map((l) => [l.listingId, { status: l.status }]));

      const items: Record<
        string,
        {
          inFavorite: boolean;
          inLike: boolean;
          inLists: { id: string; name: string }[];
          lead: { status: string } | null;
        }
      > = {};
      for (const id of listingIds) {
        items[id] = {
          inFavorite: inFavoriteSet.has(id),
          inLike: inLikeSet.has(id),
          inLists: inListsByListing.get(id) ?? [],
          lead: leadByListing.get(id) ?? null,
        };
      }
      return { items };
    }
  );
}
