/**
 * Sprint 10/11/12: tests del push a CRM. Mock HTTP.
 */
process.env.CRM_WEBHOOK_URL = 'https://crm-webhook.test/matches';
process.env.CRM_WEBHOOK_SECRET = 'test-secret';
process.env.DEMO_MODE = '1';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { enqueueCrmPush } from '../enqueue.js';
import { runCrmPushOnce } from '../worker.js';
import { CrmPushStatus } from '@prisma/client';
import { upsertListing } from '../../ingest/upsert.js';
import type { NormalizedListing } from '../../ingest/types.js';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';

const CRM_SOURCE = 'CRM_WEBHOOK' as const;

describe('CrmPush', () => {
  let listingId: string;
  let app: FastifyInstance;

  beforeAll(async () => {
    const listing = await prisma.listing.findFirst({ where: { status: 'ACTIVE' } });
    if (!listing) throw new Error('No listing for test');
    listingId = listing.id;
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await prisma.crmPushOutbox.deleteMany({ where: { listingId } });
    await app.close();
    delete process.env.CRM_WEBHOOK_URL;
    delete process.env.CRM_WEBHOOK_SECRET;
  });

  it('PENDING → SENT cuando webhook responde 200', async () => {
    let capturedBody: string;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: { body?: string }) => {
        capturedBody = opts?.body ?? '';
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        } as Response);
      })
    );

    await enqueueCrmPush(listingId, 3, ['search1', 'search2']);
    const result = await runCrmPushOnce();

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const row = await prisma.crmPushOutbox.findFirst({
      where: { listingId, status: CrmPushStatus.SENT },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toBeDefined();
    const payload = JSON.parse(capturedBody!);
    expect(payload.event).toBe('listing.matches_found');
    expect(payload.listingId).toBe(listingId);
    expect(payload.matchesCount).toBe(3);
    expect(payload.topSearchIds).toEqual(['search1', 'search2']);

    vi.unstubAllGlobals();
  });

  it('reintento ante 500: sigue PENDING y nextAttemptAt seteado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        } as Response)
      )
    );

    await enqueueCrmPush(listingId, 0, []);
    const result = await runCrmPushOnce();

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const row = await prisma.crmPushOutbox.findFirst({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toBeDefined();
    expect(row!.status).toBe(CrmPushStatus.PENDING);
    expect(row!.attempts).toBe(1);
    expect(row!.nextAttemptAt).toBeDefined();
    expect(row!.lastError).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('Sprint 11: crear listing CRM_WEBHOOK => CrmPushOutbox PENDING', async () => {
    const extId = 'sprint11-e2e-' + Date.now();
    const norm: NormalizedListing = {
      source: CRM_SOURCE,
      externalId: extId,
      status: 'ACTIVE',
      title: 'E2E CRM',
      locationText: 'Test',
    };
    const id = await upsertListing(norm);
    const row = await prisma.crmPushOutbox.findFirst({
      where: { listingId: id, status: CrmPushStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toBeDefined();
    expect(row!.matchesCount).toBeGreaterThanOrEqual(0);
    await prisma.crmPushOutbox.deleteMany({ where: { listingId: id } });
    await prisma.listing.deleteMany({ where: { id } });
  });

  it('Sprint 11: GET /admin/debug/crm-push devuelve counts', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = await app.inject({ method: 'GET', url: '/admin/debug/crm-push' });
    process.env.NODE_ENV = prevNodeEnv;
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      counts: { PENDING: number; SENT: number; FAILED: number };
      topFailed: unknown[];
      nextAttemptAtNearest: string | null;
    };
    expect(typeof body.counts.PENDING).toBe('number');
    expect(typeof body.counts.SENT).toBe('number');
    expect(typeof body.counts.FAILED).toBe('number');
    expect(Array.isArray(body.topFailed)).toBe(true);
  });

  it('Sprint 11: GET /admin/debug/match-events devuelve array', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = await app.inject({
      method: 'GET',
      url: '/admin/debug/match-events?limit=10',
    });
    process.env.NODE_ENV = prevNodeEnv;
    expect(res.statusCode).toBe(200);
    const body = res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('Sprint 12: POST resend FAILED => PENDING attempts 0', async () => {
    const outboxId = await enqueueCrmPush(listingId, 0, []);
    await prisma.crmPushOutbox.update({
      where: { id: outboxId },
      data: { status: CrmPushStatus.FAILED, attempts: 3, lastError: 'test' },
    });
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = await app.inject({
      method: 'POST',
      url: `/admin/debug/crm-push/${outboxId}/resend`,
    });
    process.env.NODE_ENV = prevNodeEnv;
    expect(res.statusCode).toBe(200);
    const row = await prisma.crmPushOutbox.findUnique({ where: { id: outboxId } });
    expect(row!.status).toBe(CrmPushStatus.PENDING);
    expect(row!.attempts).toBe(0);
    expect(row!.lastError).toBeNull();
    await prisma.crmPushOutbox.delete({ where: { id: outboxId } });
  });
});
