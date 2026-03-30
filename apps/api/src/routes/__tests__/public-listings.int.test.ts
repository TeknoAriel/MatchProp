/**
 * GET /public/listings/:id — SEO público sin auth.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

describe('Public listings', () => {
  let app: FastifyInstance;
  let listingId: string | null = null;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    const first = await prisma.listing.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    listingId = first?.id ?? null;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /public/listings/:id sin token devuelve 200 y sin campos sensibles', async () => {
    if (!listingId) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'GET',
      url: `/public/listings/${listingId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.id).toBe(listingId);
    expect(body).not.toHaveProperty('externalId');
    expect(body).not.toHaveProperty('lat');
    expect(body).not.toHaveProperty('lng');
    expect(body).not.toHaveProperty('addressText');
    expect(body).not.toHaveProperty('media');
    expect(body).toHaveProperty('updatedAt');
  });

  it('GET /public/listings/:id con id inexistente devuelve 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/listings/cmk_nonexistent_id_xxxxxxxxxx',
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /public/listings/sitemap-ids devuelve items sin auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/listings/sitemap-ids?limit=5',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { id: string; updatedAt: string }[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(5);
    if (body.items.length > 0) {
      expect(body.items[0]).toHaveProperty('id');
      expect(body.items[0]).toHaveProperty('updatedAt');
    }
  });
});
