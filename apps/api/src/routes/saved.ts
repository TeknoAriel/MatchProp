import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { SavedListType } from '@prisma/client';

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
          const heroImageUrl = listing.heroImageUrl ?? listing.media?.[0]?.url ?? null;
          return {
            id: s.id,
            listingId: s.listingId,
            listType: s.listType,
            listing: {
              ...listing,
              heroImageUrl,
              media: listing.media,
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
