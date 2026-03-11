import type { FastifyInstance } from 'fastify';
import { getAccessExpirySeconds } from './session.js';

export function signAccessToken(
  fastify: FastifyInstance,
  payload: { userId: string; email: string; role: string }
): string {
  return fastify.jwt.sign(payload, { expiresIn: getAccessExpirySeconds() });
}
