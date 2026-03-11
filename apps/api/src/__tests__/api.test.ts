import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { runIngest } from '../services/ingest/index.js';

describe('API', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    await runIngest({ source: 'API_PARTNER_1', limit: 200 });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@matchprop.com', password: 'demo' },
      headers: { 'content-type': 'application/json' },
    });
    if (res.statusCode === 200) token = res.json().token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login ok', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@matchprop.com', password: 'demo' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    token = body.token;
  });

  it('/feed devuelve items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('después de 1 swipe, el feed ya no incluye esa listing', async () => {
    const feedBefore = await app.inject({
      method: 'GET',
      url: '/feed?limit=50',
      headers: { authorization: `Bearer ${token}` },
    });
    const items = feedBefore.json().items as { id: string }[];
    expect(items.length).toBeGreaterThan(0);
    const listingId = items[0]!.id;

    await app.inject({
      method: 'POST',
      url: '/swipes',
      payload: { listingId, decision: 'LIKE' },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });

    const feedAfter = await app.inject({
      method: 'GET',
      url: '/feed?limit=50',
      headers: { authorization: `Bearer ${token}` },
    });
    const idsAfter = (feedAfter.json().items as { id: string }[]).map((p) => p.id);
    expect(idsAfter).not.toContain(listingId);
  });

  it('swipe idempotente - mismo listingId dos veces devuelve mismo id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const listing = await prisma.listing.findFirst();
    expect(listing).toBeDefined();
    const listingId = listing!.id;

    const res1 = await app.inject({
      method: 'POST',
      url: '/swipes',
      payload: { listingId, decision: 'NOPE' },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(201);
    const id1 = res1.json().id;

    const res2 = await app.inject({
      method: 'POST',
      url: '/swipes',
      payload: { listingId, decision: 'NOPE' },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(201);
    const id2 = res2.json().id;

    expect(id1).toBe(id2);
  });

  it('limit > 50 -> 400 y code INVALID_LIMIT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=99',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_LIMIT');
  });

  it('cursor inválido -> 400 y code INVALID_CURSOR', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=5&cursor=invalid-cursor!!!',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_CURSOR');
    expect(body.message).toBeDefined();
  });

  it('paginación: ids no se repiten entre página 1 y 2', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: '/feed?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    const ids1 = (body1.items as { id: string }[]).map((p) => p.id);
    const nextCursor = body1.nextCursor;

    if (!nextCursor || ids1.length < 5) {
      return;
    }

    const res2 = await app.inject({
      method: 'GET',
      url: `/feed?limit=5&cursor=${encodeURIComponent(nextCursor)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    const ids2 = (res2.json().items as { id: string }[]).map((p) => p.id);
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  it('total estable: includeTotal=1 primera página, cursor usa cache', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: '/feed?limit=5&includeTotal=1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    const total1 = body1.total as number | null;
    const nextCursor = body1.nextCursor;

    if (!nextCursor || total1 == null) return;

    const res2 = await app.inject({
      method: 'GET',
      url: `/feed?limit=5&cursor=${encodeURIComponent(nextCursor)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    const total2 = res2.json().total as number | null;
    expect(total2).toBe(total1);
  });

  it('preference: PUT /preferences y /feed respeta operation=SALE', async () => {
    await app.inject({
      method: 'POST',
      url: '/me/active-search',
      payload: { searchId: null },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });
    await app.inject({
      method: 'PUT',
      url: '/preferences',
      payload: { operation: 'SALE' },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=50',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as { operationType?: string }[];
    for (const p of items) {
      expect(p.operationType).toBe('SALE');
    }
  });

  it('override: query param operation=RENT pisa preference SALE', async () => {
    await app.inject({
      method: 'PUT',
      url: '/preferences',
      payload: { operation: 'SALE' },
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=50&operation=RENT',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as { operationType?: string }[];
    for (const p of items) {
      expect(p.operationType).toBe('RENT');
    }
  });

  it('minPrice > maxPrice -> 400 INVALID_FILTERS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=5&minPrice=200000&maxPrice=50000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_FILTERS');
    expect(body.message).toMatch(/minPrice|priceMin/);
  });
});
