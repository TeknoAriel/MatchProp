/**
 * Tests de integración del endpoint /status/listings-count.
 * Solo responde en DEMO_MODE.
 */
process.env.DEMO_MODE = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

describe('Status listings-count', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    const count = await prisma.listing.count({ where: { status: 'ACTIVE' } });
    if (count === 0) {
      await prisma.listing.create({
        data: {
          source: 'API_PARTNER_1',
          externalId: 'status-test-1',
          status: 'ACTIVE',
          title: 'Test',
          heroImageUrl: '/demo/photos/photo-01.svg',
          locationText: 'Test',
          lastSyncedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /status/listings-count en DEMO_MODE => 200 y total >= 1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/status/listings-count',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { total: number; bySource: Record<string, number> };
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(typeof body.bySource).toBe('object');
  });

  it('GET /status/listings-count sin DEMO_MODE => 404', async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = '0';
    const res = await app.inject({
      method: 'GET',
      url: '/status/listings-count',
    });
    process.env.DEMO_MODE = prev;
    expect(res.statusCode).toBe(404);
  });
});
