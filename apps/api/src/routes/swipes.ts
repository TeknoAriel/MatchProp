import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { SwipeDecisionType } from '@prisma/client';

export async function swipeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/swipes',
    {
      schema: {
        tags: ['Swipes'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['listingId', 'decision'],
          properties: {
            listingId: { type: 'string' },
            decision: { type: 'string', enum: ['LIKE', 'NOPE'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              decision: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { listingId: string; decision: string };

      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId },
      });
      if (!listing) throw fastify.httpErrors.notFound('Listing no encontrado');

      const decision = body.decision === 'LIKE' ? SwipeDecisionType.LIKE : SwipeDecisionType.NOPE;

      const swipe = await prisma.swipeDecision.upsert({
        where: {
          userId_listingId: {
            userId: user.userId,
            listingId: body.listingId,
          },
        },
        create: {
          userId: user.userId,
          listingId: body.listingId,
          decision,
        },
        update: { decision },
      });

      return reply.status(201).send({
        id: swipe.id,
        decision: swipe.decision,
      });
    }
  );
}
