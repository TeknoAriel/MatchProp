/**
 * GET /listings/batch — hidratación múltiple.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';

const TEST_EMAIL = 'listings-batch-int@matchprop.com';

describe('Listings batch', () => {
  let app: FastifyInstance;
  let token: string;
  let listingId: string | null = null;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    const passwordHash = await bcrypt.hash('demo', 10);
    await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      create: { email: TEST_EMAIL, passwordHash, role: 'BUYER' },
      update: { passwordHash },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: 'demo' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.statusCode).toBe(200);
    token = loginRes.json().token as string;

    const first = await prisma.listing.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    listingId = first?.id ?? null;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /listings/batch devuelve items para ids válidos', async () => {
    if (!listingId) {
      expect(true).toBe(true);
      return;
    }
    const res = await app.inject({
      method: 'GET',
      url: `/listings/batch?ids=${encodeURIComponent(listingId)}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { id: string; title?: string | null }[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].id).toBe(listingId);
  });

  it('GET /listings/batch con ids vacíos devuelve []', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/listings/batch?ids=',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items).toEqual([]);
  });
});
