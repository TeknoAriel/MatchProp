import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  createPropertySchema,
  updatePropertySchema,
  listPropertiesQuerySchema,
} from '../schemas/property.js';
import { UserRole } from '@prisma/client';

export async function propertyRoutes(fastify: FastifyInstance) {
  const requireAdminOrAgent = [
    fastify.authenticate,
    fastify.requireRole([UserRole.ADMIN, UserRole.AGENT]),
  ];
  const requireAuth = [fastify.authenticate];

  fastify.post(
    '/properties',
    {
      preHandler: requireAdminOrAgent,
      schema: {
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'price'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'integer' },
            currency: { type: 'string', enum: ['USD', 'ARS'] },
            locationText: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            bedrooms: { type: 'integer' },
            bathrooms: { type: 'integer' },
            areaM2: { type: 'integer' },
            operation: { type: 'string', enum: ['SALE', 'RENT'] },
            propertyType: {
              type: 'string',
              enum: ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'],
            },
            photos: { type: 'array', items: { type: 'string' } },
          },
        },
        response: { 201: { type: 'object', properties: { id: { type: 'string' } } } },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string; role: UserRole };
      const body = createPropertySchema.parse(request.body);

      const property = await prisma.property.create({
        data: {
          ...body,
          ...(user.role === UserRole.AGENT ? { createdById: user.userId } : {}),
        } as Parameters<typeof prisma.property.create>[0]['data'],
      });
      return reply.status(201).send(property);
    }
  );

  fastify.get(
    '/properties',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            operation: { type: 'string', enum: ['SALE', 'RENT'] },
            propertyType: {
              type: 'string',
              enum: ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'],
            },
            minPrice: { type: 'integer' },
            maxPrice: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { type: 'object' } },
              total: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request) => {
      const query = listPropertiesQuerySchema.parse(request.query);
      const where: Record<string, unknown> = {};
      if (query.operation) where.operation = query.operation;
      if (query.propertyType) where.propertyType = query.propertyType;
      const priceFilter: { gte?: number; lte?: number } = {};
      if (query.minPrice) priceFilter.gte = query.minPrice;
      if (query.maxPrice) priceFilter.lte = query.maxPrice;
      if (Object.keys(priceFilter).length) where.price = priceFilter;

      const [items, total] = await Promise.all([
        prisma.property.findMany({
          where,
          skip: query.offset,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.property.count({ where }),
      ]);
      return { items, total };
    }
  );

  fastify.get(
    '/properties/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { type: 'object' } },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) throw fastify.httpErrors.notFound('Propiedad no encontrada');
      return property;
    }
  );

  fastify.patch(
    '/properties/:id',
    {
      preHandler: requireAdminOrAgent,
      schema: {
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: { type: 'object' },
        response: { 200: { type: 'object' } },
      },
    },
    async (request) => {
      const user = request.user as { userId: string; role: UserRole };
      const { id } = request.params as { id: string };
      const body = updatePropertySchema.parse(request.body);

      const existing = await prisma.property.findUnique({ where: { id } });
      if (!existing) throw fastify.httpErrors.notFound('Propiedad no encontrada');

      if (user.role === UserRole.AGENT && existing.createdById !== user.userId) {
        throw fastify.httpErrors.forbidden('Solo el owner o ADMIN puede editar');
      }

      const property = await prisma.property.update({
        where: { id },
        data: body,
      });
      return property;
    }
  );

  fastify.delete(
    '/properties/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireRole([UserRole.ADMIN])],
      schema: {
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.property.findUnique({ where: { id } });
      if (!existing) throw fastify.httpErrors.notFound('Propiedad no encontrada');
      await prisma.property.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
