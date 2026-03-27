import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { trackEvent } from '../lib/analytics.js';
import { isProductionRuntime } from '../lib/error-handler.js';
import { extractFromRawJson } from '../lib/rawjson-fallback.js';

type ListingWithMedia = Prisma.ListingGetPayload<{
  include: { media: { orderBy: { sortOrder: 'asc' } } };
}>;

const MAX_LISTING_BATCH = 40;

function listingRecordToApiResponse(listing: ListingWithMedia, opts?: { viewUserId?: string }) {
  if (opts?.viewUserId) {
    trackEvent('listing_viewed', {
      userId: opts.viewUserId,
      payload: { listingId: listing.id },
    }).catch(() => {});
  }

  let mediaList = listing.media.map((m) => ({ url: m.url, sortOrder: m.sortOrder }));
  let heroImageUrl = listing.heroImageUrl;
  let title = listing.title;
  if ((!heroImageUrl || !title?.trim() || mediaList.length === 0) && listing.rawJson) {
    const fb = extractFromRawJson(listing.rawJson);
    if (!heroImageUrl) heroImageUrl = fb.heroImageUrl;
    if (!title?.trim()) title = fb.title;
    if (mediaList.length === 0 && fb.mediaUrls.length) {
      mediaList = fb.mediaUrls.map((m) => ({ url: m.url, sortOrder: m.sortOrder }));
    }
  }
  const photosCount = mediaList.length || (heroImageUrl ? 1 : 0);
  const details =
    listing.details != null && typeof listing.details === 'object'
      ? (listing.details as object)
      : null;

  return {
    id: listing.id,
    source: listing.source,
    externalId: listing.externalId,
    title,
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
    heroImageUrl,
    photosCount,
    details,
    media: mediaList,
  };
}

export async function listingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/listings/batch',
    {
      schema: {
        tags: ['Listings'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: { type: 'string', description: 'IDs separados por coma (máx. 40)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const idsRaw = (request.query as { ids?: string }).ids ?? '';
      const listingIds = Array.from(
        new Set(
          idsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ).slice(0, MAX_LISTING_BATCH);
      if (listingIds.length === 0) return { items: [] };

      const rows = await prisma.listing.findMany({
        where: { id: { in: listingIds }, status: 'ACTIVE' },
        include: { media: { orderBy: { sortOrder: 'asc' } } },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = listingIds
        .map((id) => byId.get(id))
        .filter((r): r is ListingWithMedia => r != null)
        .map((r) => listingRecordToApiResponse(r));
      return { items };
    }
  );

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

      const user = request.user as { userId: string } | undefined;
      return listingRecordToApiResponse(
        listing,
        user?.userId ? { viewUserId: user.userId } : undefined
      );
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

  /** Push manual del lead a Kiteprop (callback yumblin). Por ahora property_id fijo "34". */
  fastify.post(
    '/listings/:id/push-kiteprop',
    {
      schema: {
        tags: ['Listings'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, message: { type: 'string' } },
          },
          502: {
            type: 'object',
            properties: { ok: { type: 'boolean' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id: listingId } = request.params as { id: string };

      const lead = await prisma.lead.findFirst({
        where: { userId: user.userId, listingId },
        include: {
          user: { include: { profile: true } },
          listing: { select: { title: true } },
        },
      });
      if (!lead) throw fastify.httpErrors.notFound('No hay consulta enviada para esta propiedad');

      const email = lead.user?.email ?? 'unknown@matchprop.com';
      const profile = lead.user?.profile;
      const phone = profile?.phone ?? profile?.whatsapp ?? '';
      const name =
        [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
        email.split('@')[0] ||
        'Usuario';
      const body =
        lead.message ?? `Consulta desde MatchProp sobre ${lead.listing?.title ?? 'propiedad'}`;

      const payload = {
        name,
        email,
        phone: phone || '+549000000000',
        property_id: '34',
        body,
      };

      const url = 'https://www.kiteprop.com/difusions/messages/callback/yumblin';
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow',
        });
        if (!res.ok) {
          const text = await res.text();
          request.log.warn(
            { status: res.status, bodyPreview: text.slice(0, 200) },
            'Kiteprop callback responded with error'
          );
          return reply.status(502).send({
            ok: false,
            message: isProductionRuntime()
              ? 'Error al enviar la consulta. Intentá más tarde.'
              : `Kiteprop respondió ${res.status}: ${text.slice(0, 200)}`,
          });
        }
        return { ok: true, message: 'Lead enviado a Kiteprop' };
      } catch (err) {
        request.log.error({ err }, 'Kiteprop callback failed');
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(502).send({
          ok: false,
          message: isProductionRuntime()
            ? 'Error al enviar la consulta. Intentá más tarde.'
            : `Error al conectar con Kiteprop: ${msg}`,
        });
      }
    }
  );
}
