import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { normalizeFilters } from '../schemas/search.js';

function toSearchDTO(row: {
  id: string;
  name: string;
  queryText: string | null;
  filtersJson: unknown;
  updatedAt: Date;
}) {
  const filters = normalizeFilters(row.filtersJson);
  return {
    id: row.id,
    name: row.name,
    queryText: row.queryText,
    filters,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function activeSearchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/me/active-search',
    {
      schema: {
        tags: ['Me'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              search: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  queryText: { type: ['string', 'null'] },
                  filters: { type: 'object' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { activeSearchId: true },
      });
      if (!u?.activeSearchId) return { search: null };
      const search = await prisma.savedSearch.findFirst({
        where: { id: u.activeSearchId, userId: user.userId },
      });
      if (!search) {
        await prisma.user.update({
          where: { id: user.userId },
          data: { activeSearchId: null },
        });
        return { search: null };
      }
      return { search: toSearchDTO(search) };
    }
  );

  fastify.post(
    '/me/active-search',
    {
      schema: {
        tags: ['Me'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            searchId: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              search: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  queryText: { type: ['string', 'null'] },
                  filters: { type: 'object' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { searchId?: string | null };
      const searchId = body.searchId === undefined ? null : body.searchId;

      if (searchId === null || searchId === '') {
        await prisma.user.update({
          where: { id: user.userId },
          data: { activeSearchId: null },
        });
        return { search: null };
      }

      const search = await prisma.savedSearch.findFirst({
        where: { id: searchId, userId: user.userId },
      });
      if (!search) {
        return reply.status(404).send({ message: 'SavedSearch no encontrado' }) as never;
      }

      await prisma.user.update({
        where: { id: user.userId },
        data: { activeSearchId: search.id },
      });
      return { search: toSearchDTO(search) };
    }
  );
}
