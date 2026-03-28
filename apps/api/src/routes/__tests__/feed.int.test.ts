/**
 * Tests de integración del endpoint /feed (Listing-based).
 * Requiere DB (docker compose up -d) y migraciones aplicadas.
 * Ejecutar: pnpm --filter api test:all
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { feedResponseV1Schema } from '../../schemas/feed.js';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { runIngest } from '../../services/ingest/index.js';

const TEST_USER_EMAIL = 'feed-int-test@matchprop.com';

describe('Feed integration', () => {
  let app: FastifyInstance;
  let token: string;
  beforeAll(async () => {
    app = await buildApp({ logger: false });

    const passwordHash = await bcrypt.hash('demo', 10);
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: { email: TEST_USER_EMAIL, passwordHash, role: 'AGENT' },
      update: { passwordHash },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_USER_EMAIL, password: 'demo' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed: ${loginRes.statusCode} ${loginRes.body}`);
    }
    token = loginRes.json().token as string;

    await prisma.swipeDecision.deleteMany({
      where: { user: { email: TEST_USER_EMAIL } },
    });
    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    await runIngest({ source: 'API_PARTNER_1', limit: 200 });
  });

  afterAll(async () => {
    await app.close();
  });

  const cardFields = [
    'id',
    'title',
    'price',
    'currency',
    'bedrooms',
    'bathrooms',
    'areaTotal',
    'locationText',
    'heroImageUrl',
    'publisherRef',
    'source',
  ] as const;

  const forbiddenFields = ['description', 'rawJson', 'createdAt'];

  it('contrato base: response cumple FeedResponseV1 schema (zod)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=10',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const parsed = feedResponseV1Schema.safeParse(res.json());
    expect(parsed.success).toBe(true);
  });

  it('contrato base: GET /feed?limit=10 responde 200, items <= 10, shape ListingCard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=10',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      items: unknown[];
      total: unknown;
      limit: number;
      nextCursor: unknown;
    };
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(10);
    expect(body.limit).toBe(10);

    for (const item of body.items as Record<string, unknown>[]) {
      for (const field of cardFields) {
        expect(item).toHaveProperty(field);
      }
      for (const field of forbiddenFields) {
        expect(item).not.toHaveProperty(field);
      }
    }
  });

  it('todos los items tienen id truthy string, ninguno undefined/null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=50',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { id: unknown }[] };
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) {
      expect(item.id).toBeDefined();
      expect(item.id).not.toBeNull();
      expect(item.id).not.toBe('undefined');
      expect(item.id).not.toBe('null');
      expect(typeof item.id).toBe('string');
      expect((item.id as string).length).toBeGreaterThan(0);
    }
  });

  it('nextCursor presente cuando hay más items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=2',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; nextCursor: string | null };
    if (body.items.length >= 2) {
      expect(body.nextCursor).toBeTruthy();
      expect(typeof body.nextCursor).toBe('string');
    }
  });

  it('paginación: ids no se repiten entre page1 y page2', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: '/feed?limit=2',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json() as { items: { id: string }[]; nextCursor: string | null };
    const ids1 = body1.items.map((p) => p.id);

    if (!body1.nextCursor || ids1.length < 2) return;

    const res2 = await app.inject({
      method: 'GET',
      url: `/feed?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    const ids2 = (res2.json() as { items: { id: string }[] }).items.map((p) => p.id);
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  it('includeTotal=false (default): total === null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=10',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { total: number | null };
    expect(body.total).toBeNull();
  });

  it('includeTotal=1: total es number y coincide con count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=10&includeTotal=1',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number; nextCursor: string | null };
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(body.items.length);

    if (body.nextCursor) {
      const res2 = await app.inject({
        method: 'GET',
        url: `/feed?limit=10&cursor=${encodeURIComponent(body.nextCursor)}&includeTotal=1`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json() as { total: number };
      expect(body2.total).toBe(body.total);
    }
  });

  it('cursor muy largo => 400', async () => {
    const longCursor = 'a'.repeat(300);
    const res = await app.inject({
      method: 'GET',
      url: `/feed?limit=5&cursor=${encodeURIComponent(longCursor)}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { code?: string };
    expect(body.code).toBe('INVALID_CURSOR');
  });

  it('cursor base64 inválido => 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/feed?limit=5&cursor=!!!invalid!!!',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { code?: string; message?: string };
    expect(body.code).toBe('INVALID_CURSOR');
    expect(body.message).toBeDefined();
    expect(body.message).not.toContain('!!!');
  });

  it('sin sortBy en query no hereda sortBy de búsqueda activa; con sortBy=price_asc ordena por precio', async () => {
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
      select: { id: true },
    });
    if (!user) throw new Error('user missing');

    const search = await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name: 'feed-sort-inherit-test',
        filtersJson: { operationType: 'SALE', sortBy: 'price_asc' },
        updatedAt: new Date(),
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { activeSearchId: search.id },
    });
    try {
      const resDefault = await app.inject({
        method: 'GET',
        url: '/feed?limit=25',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resPrice = await app.inject({
        method: 'GET',
        url: '/feed?limit=25&sortBy=price_asc',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resDefault.statusCode).toBe(200);
      expect(resPrice.statusCode).toBe(200);
      const a = resDefault.json() as { items: { id: string; price: number | null }[] };
      const b = resPrice.json() as { items: { id: string; price: number | null }[] };
      const pricesB = b.items.map((i) => i.price).filter((p): p is number => p != null);
      for (let i = 1; i < pricesB.length; i++) {
        expect(pricesB[i]!).toBeGreaterThanOrEqual(pricesB[i - 1]!);
      }
      if (a.items.length >= 3 && b.items.length >= 3) {
        const idsA = a.items.map((i) => i.id).join(',');
        const idsB = b.items.map((i) => i.id).join(',');
        expect(idsA).not.toBe(idsB);
      }
    } finally {
      await prisma.savedSearch.delete({ where: { id: search.id } }).catch(() => {});
      await prisma.user.update({
        where: { id: user.id },
        data: { activeSearchId: null },
      });
    }
  });

  it('exclusión NOPE: listings con swipe NOPE no aparecen en feed', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: '/feed?limit=10',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json() as { items: { id: string }[] };
    if (body1.items.length === 0) return;

    const firstId = body1.items[0]!.id;
    await app.inject({
      method: 'POST',
      url: '/swipes',
      payload: { listingId: firstId, decision: 'NOPE' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });

    const res2 = await app.inject({
      method: 'GET',
      url: '/feed?limit=20',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.statusCode).toBe(200);
    const ids2 = (res2.json() as { items: { id: string }[] }).items.map((p) => p.id);
    expect(ids2).not.toContain(firstId);
  });
});
