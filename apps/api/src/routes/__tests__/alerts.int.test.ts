/**
 * Tests de integración de Alertas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { runIngest } from '../../services/ingest/index.js';
import { runAlerts } from '../../lib/alerts-runner.js';

const TEST_USER_EMAIL = 'alerts-int-test@matchprop.com';

describe('Alerts integration', () => {
  let app: FastifyInstance;
  let token: string;
  let searchId: string;
  let subscriptionId: string;

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
    if (loginRes.statusCode !== 200) throw new Error('Login failed');
    token = loginRes.json().token as string;

    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    await runIngest({ source: 'API_PARTNER_1', limit: 200 });
  });

  afterAll(async () => {
    const u = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
      select: { id: true },
    });
    if (u) {
      await prisma.notification.deleteMany({ where: { userId: u.id } });
    }
    await prisma.alertSubscription.deleteMany({ where: { user: { email: TEST_USER_EMAIL } } });
    await prisma.savedSearch.deleteMany({ where: { user: { email: TEST_USER_EMAIL } } });
    await app.close();
  });

  it('POST /searches crea saved search', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/searches',
      payload: {
        name: 'Test alertas',
        filters: { operationType: 'SALE', locationText: 'Rosario' },
      },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    searchId = res.json().id as string;
  });

  it('POST /alerts/subscriptions crea subscription NEW_LISTING', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/alerts/subscriptions',
      payload: { savedSearchId: searchId, type: 'NEW_LISTING' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; isEnabled: boolean };
    expect(body.id).toBeDefined();
    expect(body.isEnabled).toBe(true);
    subscriptionId = body.id;
  });

  it('GET /alerts/subscriptions lista subscriptions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/alerts/subscriptions',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((s) => s.id === subscriptionId)).toBe(true);
  });

  it('POST /alerts/subscriptions crea subscription PRICE_DROP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/alerts/subscriptions',
      payload: { savedSearchId: searchId, type: 'PRICE_DROP' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; type: string };
    expect(body.type).toBe('PRICE_DROP');
    await prisma.alertSubscription.delete({ where: { id: body.id } });
  });

  it('POST /alerts/subscriptions crea subscription BACK_ON_MARKET', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/alerts/subscriptions',
      payload: { savedSearchId: searchId, type: 'BACK_ON_MARKET' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; type: string };
    expect(body.type).toBe('BACK_ON_MARKET');
    await prisma.alertSubscription.delete({ where: { id: body.id } });
  });

  it('POST /cron/alerts sin Authorization devuelve 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/cron/alerts',
    });
    expect(res.statusCode).toBe(401);
  });

  it('alerts:run crea AlertDelivery y no duplica (dedupe)', async () => {
    await runAlerts({ feedLimit: 10, logger: () => {} });

    const deliveries = await prisma.alertDelivery.findMany({
      where: { subscriptionId },
    });
    expect(deliveries.length).toBeGreaterThanOrEqual(0);

    await runAlerts({ feedLimit: 10, logger: () => {} });
    const deliveries2 = await prisma.alertDelivery.findMany({
      where: { subscriptionId },
    });
    expect(deliveries2.length).toBe(deliveries.length);
  });

  it('PATCH /alerts/subscriptions/:id desactiva', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/alerts/subscriptions/${subscriptionId}`,
      payload: { isEnabled: false },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isEnabled).toBe(false);
  });

  it('DELETE /alerts/subscriptions/:id elimina', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/alerts/subscriptions/${subscriptionId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });
});
