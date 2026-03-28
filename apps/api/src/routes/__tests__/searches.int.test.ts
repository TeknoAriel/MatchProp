/**
 * Tests de integración de SavedSearch y /searches/:id/results.
 * Requiere DB. Ejecutar: pnpm --filter api test:all
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { runIngest } from '../../services/ingest/index.js';

const TEST_USER_EMAIL = 'searches-int-test@matchprop.com';

describe('Searches integration', () => {
  let app: FastifyInstance;
  let token: string;
  let searchId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    const passwordHash = await bcrypt.hash('demo', 10);
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: { email: TEST_USER_EMAIL, passwordHash, role: 'BUYER' },
      update: { passwordHash },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_USER_EMAIL, password: 'demo' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed: ${loginRes.statusCode}`);
    }
    token = loginRes.json().token as string;

    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    await runIngest({ source: 'API_PARTNER_1', limit: 200 });
  });

  afterAll(async () => {
    await prisma.savedSearch.deleteMany({
      where: { user: { email: TEST_USER_EMAIL } },
    });
    await app.close();
  });

  it('POST /assistant/search devuelve filters, explanation y warnings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assistant/search',
      payload: { text: 'departamento en Palermo hasta 100k' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      filters: Record<string, unknown>;
      explanation: string;
      warnings?: string[];
    };
    expect(body.filters).toBeDefined();
    expect(Object.keys(body.filters).length).toBeGreaterThan(0);
    expect(typeof body.explanation).toBe('string');
    expect(Array.isArray(body.warnings)).toBe(true);
    expect((body.warnings ?? []).length).toBe(0);
  });

  it('POST /assistant/search con texto smoke devuelve filters NO vacío', async () => {
    const text = 'Quiero comprar depto 2 dorm en Rosario hasta 120k usd';
    const res = await app.inject({
      method: 'POST',
      url: '/assistant/search',
      payload: { text },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { filters: Record<string, unknown>; explanation: string };
    expect(Object.keys(body.filters).length).toBeGreaterThan(0);
    expect(body.filters.operationType).toBe('SALE');
    expect(body.filters.priceMax).toBe(120000);
    expect(body.filters.currency).toBe('USD');
    expect(body.filters.bedroomsMin).toBe(2);
    expect((body.filters.locationText as string) || '').toContain('Rosario');
  });

  it('POST /assistant/preview devuelve items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assistant/preview',
      payload: {
        filters: { operationType: 'SALE', locationText: 'Rosario' },
        limit: 5,
      },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('POST /assistant/preview con fallbackMode RELAX y FEED devuelve items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assistant/preview',
      payload: {
        filters: { operationType: 'SALE', locationText: 'Rosario' },
        limit: 5,
        fallbackMode: 'STRICT',
      },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.items)).toBe(true);

    const resFeed = await app.inject({
      method: 'POST',
      url: '/assistant/preview',
      payload: { filters: {}, limit: 5, fallbackMode: 'FEED' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(resFeed.statusCode).toBe(200);
    const bodyFeed = resFeed.json() as { items: unknown[] };
    expect(bodyFeed.items.length).toBeGreaterThanOrEqual(0);
  });

  it('POST /searches crea saved search', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/searches',
      payload: {
        name: 'Test búsqueda',
        filters: { operationType: 'SALE', locationText: 'Rosario' },
      },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; name: string };
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Test búsqueda');
    searchId = body.id;
  });

  it('GET /searches lista búsquedas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/searches',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((s) => s.id === searchId)).toBe(true);
  });

  it('GET /searches/:id/results devuelve items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/searches/${searchId}/results?limit=5`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('GET /searches/:id/results?sortBy=price_asc ordena precios no decreciente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/searches/${searchId}/results?limit=20&sortBy=price_asc`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { price: number | null }[] };
    const prices = body.items.map((i) => i.price).filter((p): p is number => p != null);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
    }
  });

  it('paginación cursor sin duplicados', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: `/searches/${searchId}/results?limit=2`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json() as { items: { id?: string }[]; nextCursor: string | null };
    const ids1 = body1.items.map((i) => i?.id).filter(Boolean) as string[];

    if (!body1.nextCursor || body1.items.length < 2) return;

    const res2 = await app.inject({
      method: 'GET',
      url: `/searches/${searchId}/results?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json() as { items: { id?: string }[] };
    const ids2 = body2.items.map((i) => i?.id).filter(Boolean) as string[];
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });
});
