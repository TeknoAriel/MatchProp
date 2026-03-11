import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { upsertPreferenceSchema } from '../schemas/preference.js';

export async function preferenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/preferences',
    {
      schema: {
        tags: ['Preferences'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              minPrice: { type: 'integer' },
              maxPrice: { type: 'integer' },
              currency: { type: 'string' },
              operation: { type: 'string' },
              propertyTypes: {},
              bedroomsMin: { type: 'integer' },
              bathroomsMin: { type: 'integer' },
              areaMin: { type: 'integer' },
              locationText: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const pref = await prisma.preference.findUnique({
        where: { userId: user.userId },
      });
      return pref;
    }
  );

  fastify.put(
    '/preferences',
    {
      schema: {
        tags: ['Preferences'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            minPrice: { type: 'integer' },
            maxPrice: { type: 'integer' },
            currency: { type: 'string' },
            operation: { type: 'string', enum: ['SALE', 'RENT'] },
            propertyTypes: { type: 'array', items: { type: 'string' } },
            bedroomsMin: { type: 'integer' },
            bathroomsMin: { type: 'integer' },
            areaMin: { type: 'integer' },
            locationText: { type: 'string' },
          },
        },
        response: { 200: { type: 'object' } },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const body = upsertPreferenceSchema.parse(request.body);

      const existing = await prisma.preference.findUnique({
        where: { userId: user.userId },
      });

      const norm = (v: string | null | undefined) => (v === '' ? null : (v ?? null));

      const bodyNorm = {
        minPrice: body.minPrice ?? null,
        maxPrice: body.maxPrice ?? null,
        currency: body.currency ?? null,
        operation: body.operation ?? null,
        propertyTypes: body.propertyTypes ?? null,
        bedroomsMin: body.bedroomsMin ?? null,
        bathroomsMin: body.bathroomsMin ?? null,
        areaMin: body.areaMin ?? null,
        locationText: norm(body.locationText),
      };

      const existingNorm = existing
        ? {
            minPrice: existing.minPrice,
            maxPrice: existing.maxPrice,
            currency: existing.currency,
            operation: existing.operation,
            propertyTypes: existing.propertyTypes,
            bedroomsMin: existing.bedroomsMin,
            bathroomsMin: existing.bathroomsMin,
            areaMin: existing.areaMin,
            locationText: norm(existing.locationText),
          }
        : null;

      const propTypesEqual =
        JSON.stringify(bodyNorm.propertyTypes ?? []) ===
        JSON.stringify(existingNorm?.propertyTypes ?? []);

      const isEqual =
        existingNorm &&
        bodyNorm.minPrice === existingNorm.minPrice &&
        bodyNorm.maxPrice === existingNorm.maxPrice &&
        bodyNorm.currency === existingNorm.currency &&
        bodyNorm.operation === existingNorm.operation &&
        propTypesEqual &&
        bodyNorm.bedroomsMin === existingNorm.bedroomsMin &&
        bodyNorm.bathroomsMin === existingNorm.bathroomsMin &&
        bodyNorm.areaMin === existingNorm.areaMin &&
        bodyNorm.locationText === existingNorm.locationText;

      if (isEqual && existing) return existing;

      const pref = await prisma.preference.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...body },
        update: body,
      });
      return pref;
    }
  );
}
