import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { extractFromRawJson } from '../lib/rawjson-fallback.js';

const DESC_MAX = 320;

function truncateDesc(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  return t.length <= DESC_MAX ? t : `${t.slice(0, DESC_MAX - 1)}…`;
}

/**
 * Vista mínima de listing para SEO, crawlers y generateMetadata en la web.
 * Sin auth. No expone externalId, dirección precisa, coordenadas ni media completa.
 */
const SITEMAP_IDS_MAX = 2500;

export async function publicListingRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/public/listings/sitemap-ids',
    {
      schema: {
        tags: ['Listings'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: SITEMAP_IDS_MAX },
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
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { limit?: number | string };
      const raw = q.limit;
      const parsed =
        typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : SITEMAP_IDS_MAX;
      const take = Math.min(SITEMAP_IDS_MAX, Math.max(1, Number.isFinite(parsed) ? parsed : SITEMAP_IDS_MAX));
      const rows = await prisma.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take,
      });
      return {
        items: rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt.toISOString() })),
      };
    }
  );

  fastify.get(
    '/public/listings/:id',
    {
      schema: {
        tags: ['Listings'],
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
              locationText: { type: ['string', 'null'] },
              heroImageUrl: { type: ['string', 'null'] },
              photosCount: { type: 'integer' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const listing = await prisma.listing.findUnique({
        where: { id, status: 'ACTIVE' },
        include: { media: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      let heroImageUrl = listing.heroImageUrl;
      let title = listing.title;
      if ((!heroImageUrl || !title?.trim()) && listing.rawJson) {
        const fb = extractFromRawJson(listing.rawJson);
        if (!heroImageUrl) heroImageUrl = fb.heroImageUrl;
        if (!title?.trim()) title = fb.title;
      }

      const photosCount = listing.media.length || (heroImageUrl ? 1 : 0);

      return reply.send({
        id: listing.id,
        title,
        description: truncateDesc(listing.description),
        operationType: listing.operationType,
        propertyType: listing.propertyType,
        price: listing.price,
        currency: listing.currency,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        areaTotal: listing.areaTotal,
        areaCovered: listing.areaCovered,
        locationText: listing.locationText,
        heroImageUrl,
        photosCount,
        updatedAt: listing.updatedAt.toISOString(),
      });
    }
  );
}
