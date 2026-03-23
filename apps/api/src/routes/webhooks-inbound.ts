import { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import {
  parseGenericInbound,
  parseKitepropInbound,
  recordPublisherReply,
} from '../services/webhooks/inbound-reply.js';

function verifyWebhookSecret(request: FastifyRequest): boolean {
  const secret = config.webhookInboundSecret;
  if (!secret) return false;
  const hdr = request.headers['x-matchprop-webhook-secret'];
  if (typeof hdr === 'string' && hdr === secret) return true;
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7) === secret;
  }
  return false;
}

/**
 * Webhooks públicos (sin JWT): requieren WEBHOOK_INBOUND_SECRET.
 * - POST /webhooks/inbound — formato genérico o Kiteprop (intenta ambos parsers).
 * - POST /webhooks/kiteprop/reply — solo parser adaptado a Kiteprop.
 */
export async function webhooksInboundRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: Record<string, unknown> }>(
    '/webhooks/inbound',
    {
      schema: {
        tags: ['Webhooks'],
        body: { type: 'object' },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              messageId: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          503: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      if (!config.webhookInboundSecret) {
        return reply.status(503).send({ error: 'WEBHOOK_INBOUND_SECRET no configurado' });
      }
      if (!verifyWebhookSecret(request)) {
        return reply.status(401).send({ error: 'No autorizado' });
      }
      const body = request.body ?? {};
      const parsed =
        parseGenericInbound(body) ?? parseKitepropInbound(body);
      if (!parsed) {
        return reply.status(400).send({
          error:
            'Payload inválido. Se espera leadId/matchprop_lead_id y message/body/reply/text.',
        });
      }
      const result = await recordPublisherReply(parsed);
      if (!result.ok) {
        return reply.status(400).send({ error: result.error ?? 'No se pudo registrar' });
      }
      return reply.send({ ok: true, messageId: result.messageId! });
    }
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/webhooks/kiteprop/reply',
    {
      schema: {
        tags: ['Webhooks'],
        body: { type: 'object' },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              messageId: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          503: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      if (!config.webhookInboundSecret) {
        return reply.status(503).send({ error: 'WEBHOOK_INBOUND_SECRET no configurado' });
      }
      if (!verifyWebhookSecret(request)) {
        return reply.status(401).send({ error: 'No autorizado' });
      }
      const body = request.body ?? {};
      const parsed = parseKitepropInbound(body);
      if (!parsed) {
        return reply.status(400).send({
          error:
            'Payload Kiteprop inválido. Campos típicos: matchprop_lead_id / lead_id / leadId + body / message / reply.',
        });
      }
      const result = await recordPublisherReply(parsed);
      if (!result.ok) {
        return reply.status(400).send({ error: result.error ?? 'No se pudo registrar' });
      }
      return reply.send({ ok: true, messageId: result.messageId! });
    }
  );
}
