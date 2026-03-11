/**
 * Tests de integración del endpoint POST /leads.
 * Ejecutar: pnpm --filter api test:all
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { runIngest } from '../../services/ingest/index.js';
import { encrypt } from '../../lib/crypto.js';
import { deliverToKiteprop } from '../../services/kiteprop/delivery.js';
import { LeadStatus } from '@prisma/client';

const TEST_USER_EMAIL = 'leads-int-test@matchprop.com';

describe('Leads integration', () => {
  let app: FastifyInstance;
  let token: string;
  let listingId: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    const passwordHash = await bcrypt.hash('demo', 10);
    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: { email: TEST_USER_EMAIL, passwordHash, role: 'AGENT' },
      update: { passwordHash },
    });
    userId = user.id;

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
    const listing = await prisma.listing.findFirst({
      where: { source: 'KITEPROP_EXTERNALSITE', publisherRef: { not: null } },
    });
    listingId = listing!.id;
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { userId: { not: null } } });
    await app.close();
  });

  it('crea lead asociado a listing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      payload: { listingId, channel: 'WHATSAPP' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; status: string };
    expect(body.id).toBeDefined();
    expect(body.status).toBe('PENDING');
  });

  it('targetPublisherRef copiado desde listing', async () => {
    const lead = await prisma.lead.findFirst({
      where: { listingId, userId: { not: null } },
      include: { listing: true },
    });
    expect(lead).toBeTruthy();
    expect(lead!.targetPublisherRef).toBe(lead!.listing.publisherRef);
  });

  it('GET /me/leads lista leads del buyer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me/leads',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; listingId: string; status: string }>;
    expect(body.length).toBeGreaterThanOrEqual(1);
    const first = body.find((l) => l.listingId === listingId);
    expect(first).toBeDefined();
    expect(first!.status).toBe('PENDING');
  });

  describe('Lead delivery Kiteprop (mock)', () => {
    let kitepropListingId: string;

    beforeAll(async () => {
      process.env.INTEGRATIONS_MASTER_KEY =
        process.env.INTEGRATIONS_MASTER_KEY || 'test-master-key-32-chars-minimum!!';
      const apiKeyEncrypted = encrypt('sk-test-leads');
      await prisma.kitepropIntegration.deleteMany({ where: { userId } });
      await prisma.kitepropIntegration.create({
        data: {
          userId,
          baseUrl: 'https://mock-kp.test',
          leadCreatePath: '/leads',
          authHeaderName: 'X-API-Key',
          authFormat: 'ApiKey',
          apiKeyEncrypted,
          isEnabled: true,
          payloadTemplate:
            '{"email":"{{buyer.email}}","message":"{{lead.message}}","listing_id":"{{listing.externalId}}"}',
        },
      });
      const listingWithoutPublisher = await prisma.listing.findFirst({
        where: { status: 'ACTIVE' },
      });
      if (!listingWithoutPublisher) throw new Error('No ACTIVE listing');
      await prisma.listing.update({
        where: { id: listingWithoutPublisher.id },
        data: { publisherId: null },
      });
      kitepropListingId = listingWithoutPublisher.id;
    });

    afterAll(async () => {
      await prisma.kitepropIntegration.deleteMany({ where: { userId } });
      if (kitepropListingId) {
        const pub = await prisma.publisher.findFirst();
        if (pub) {
          await prisma.listing.update({
            where: { id: kitepropListingId },
            data: { publisherId: pub.id },
          });
        }
      }
      vi.unstubAllGlobals();
    });

    it('Contactar -> lead -> processor envía (mock 200) -> lastDelivery OK', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve('{}'),
          } as Response)
        )
      );
      const leadRecord = await prisma.lead.create({
        data: {
          userId,
          listingId: kitepropListingId,
          publisherId: null,
          channel: 'FORM',
          source: 'FEED',
          message: 'Test',
          status: 'PENDING',
        },
      });
      const fullLead = await prisma.lead.findUnique({
        where: { id: leadRecord.id },
        include: {
          listing: true,
          user: { select: { email: true } },
          publisher: { select: { orgId: true } },
        },
      });
      if (!fullLead) throw new Error('lead not found');
      const directResult = await deliverToKiteprop(
        fullLead as Parameters<typeof deliverToKiteprop>[0],
        { testMode: false }
      );
      expect(directResult.ok).toBe(true);
      const withAttempts = await prisma.lead.findUnique({
        where: { id: leadRecord.id },
        include: { deliveryAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      expect(withAttempts?.deliveryAttempts[0]).toBeDefined();
      expect(withAttempts?.deliveryAttempts[0]?.kind).toBe('KITEPROP');
      expect(withAttempts?.deliveryAttempts[0]?.status).toBe('OK');
      expect(withAttempts?.deliveryAttempts[0]?.httpStatus).toBe(200);
      await prisma.lead.delete({ where: { id: leadRecord.id } });
    });

    it('Falla 422 -> lastDelivery FAIL con userMessage Payload inválido', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 422,
            text: () => Promise.resolve('{"errors":["invalid payload"]}'),
          } as Response)
        )
      );
      const leadRecord = await prisma.lead.create({
        data: {
          userId,
          listingId: kitepropListingId,
          publisherId: null,
          channel: 'FORM',
          source: 'FEED',
          message: 'Test 422',
          status: 'PENDING',
        },
      });
      const fullLead = await prisma.lead.findUnique({
        where: { id: leadRecord.id },
        include: {
          listing: true,
          user: { select: { email: true } },
          publisher: { select: { orgId: true } },
        },
      });
      if (!fullLead) throw new Error('lead not found');
      const directResult = await deliverToKiteprop(
        fullLead as Parameters<typeof deliverToKiteprop>[0],
        { testMode: false }
      );
      expect(directResult.ok).toBe(false);
      expect(directResult.httpStatus).toBe(422);
      const withAttempts = await prisma.lead.findUnique({
        where: { id: leadRecord.id },
        include: { deliveryAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      expect(withAttempts?.deliveryAttempts[0]?.kind).toBe('KITEPROP');
      expect(withAttempts?.deliveryAttempts[0]?.status).toBe('FAIL');
      expect(withAttempts?.deliveryAttempts[0]?.httpStatus).toBe(422);
      const { kitepropUserMessage } = await import('../../services/kiteprop/error-messages.js');
      expect(kitepropUserMessage(422, '')).toContain('Payload inválido');
      await prisma.lead.delete({ where: { id: leadRecord.id } });
    });
  });

  describe('Chat (solo ACTIVE)', () => {
    it('PENDING no permite POST /leads/:id/messages', async () => {
      const lead = await prisma.lead.findFirst({
        where: { userId, status: 'PENDING' },
      });
      if (!lead) return;
      const res = await app.inject({
        method: 'POST',
        url: `/leads/${lead.id}/messages`,
        payload: { body: 'Hola' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('ACTIVE bloquea email en body y guarda blockedReason', async () => {
      const listing = await prisma.listing.findFirst({ where: { status: 'ACTIVE' } });
      if (!listing) return;
      const activeLead = await prisma.lead.create({
        data: {
          userId,
          listingId: listing.id,
          publisherId: listing.publisherId,
          channel: 'FORM',
          source: 'FEED',
          status: LeadStatus.ACTIVE,
          activationReason: 'MANUAL_ADMIN',
          activatedAt: new Date(),
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: `/leads/${activeLead.id}/messages`,
        payload: { body: 'Contactame a test@example.com' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(201);
      const messages = await prisma.message.findMany({
        where: { leadId: activeLead.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(messages[0]).toBeDefined();
      expect(messages[0]!.blockedReason).toContain('email');
      expect(messages[0]!.body).toContain('[BLOCKED]');
      await prisma.message.deleteMany({ where: { leadId: activeLead.id } });
      await prisma.lead.delete({ where: { id: activeLead.id } });
    });
  });
});
