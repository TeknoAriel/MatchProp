/**
 * Tests de integración para /integrations/kiteprop.
 * Mock de fetch para test lead (sin internet).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { runIngest } from '../../services/ingest/index.js';

const TEST_USER_EMAIL = 'integrations-test@matchprop.com';

describe('Integrations Kiteprop', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    process.env.INTEGRATIONS_MASTER_KEY =
      process.env.INTEGRATIONS_MASTER_KEY || 'test-master-key-32-chars-minimum!!';

    app = await buildApp({ logger: false });

    const passwordHash = await bcrypt.hash('demo', 10);
    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: { email: TEST_USER_EMAIL, passwordHash, role: 'AGENT' },
      update: { passwordHash },
    });
    userId = user.id;

    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 50 });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_USER_EMAIL, password: 'demo' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.statusCode !== 200) throw new Error('Login failed');
    token = loginRes.json().token as string;

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          text: () => Promise.resolve('{"id":"mock"}'),
        } as Response)
      )
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.kitepropOpenApiSpec.deleteMany({ where: { userId } });
    await prisma.kitepropIntegration.deleteMany({ where: { userId } });
    await app.close();
  });

  it('GET /integrations/kiteprop devuelve config por defecto', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/integrations/kiteprop',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { baseUrl: string; leadCreatePath: string };
    expect(body.baseUrl).toBeDefined();
    expect(body.leadCreatePath).toBeDefined();
  });

  it('PUT /integrations/kiteprop guarda config con API key cifrada', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/integrations/kiteprop',
      payload: {
        baseUrl: 'https://api.test',
        leadCreatePath: '/leads',
        apiKey: 'sk-test-key',
        isEnabled: true,
      },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('POST /integrations/kiteprop/test envía lead de prueba', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/integrations/kiteprop/test',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; httpStatus: number };
    expect(body.ok).toBe(true);
    expect(body.httpStatus).toBe(201);
  });

  it('GET /integrations/kiteprop/spec/suggest-template devuelve template desde spec', async () => {
    const minimalSpec = JSON.stringify({
      openapi: '3.0',
      paths: {
        '/leads': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { required: ['email', 'message', 'listing_id'] },
                },
              },
            },
          },
        },
      },
    });
    await app.inject({
      method: 'POST',
      url: '/integrations/kiteprop/spec/save',
      payload: { content: minimalSpec },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/integrations/kiteprop/spec/suggest-template',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { template: string };
    const parsed = JSON.parse(body.template);
    expect(parsed.email).toBe('{{buyer.email}}');
    expect(parsed.message).toBe('{{lead.message}}');
    expect(parsed.listing_id).toBe('{{listing.externalId}}');
  });
});
