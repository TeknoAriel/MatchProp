/**
 * Tests de integración para deliverToKiteprop.
 * Mock de fetch (sin internet). Valida auth header y payload.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { encrypt } from '../../../lib/crypto.js';
import { deliverToKiteprop } from '../delivery.js';
import bcrypt from 'bcryptjs';

const TEST_USER_EMAIL = 'kiteprop-delivery-test@matchprop.com';

describe('deliverToKiteprop', () => {
  let userId: string;
  let listingId: string;
  let capturedUrl: string;
  let capturedHeaders: Record<string, string>;
  let capturedBody: string;

  beforeAll(async () => {
    process.env.INTEGRATIONS_MASTER_KEY =
      process.env.INTEGRATIONS_MASTER_KEY || 'test-master-key-32-chars-minimum!!';

    const passwordHash = await bcrypt.hash('demo', 10);
    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: { email: TEST_USER_EMAIL, passwordHash, role: 'AGENT' },
      update: { passwordHash },
    });
    userId = user.id;

    const listing = await prisma.listing.findFirst({ where: { status: 'ACTIVE' } });
    if (!listing) throw new Error('No listing for test');
    listingId = listing.id;

    const apiKeyEncrypted = encrypt('sk-test-12345');
    await prisma.kitepropIntegration.upsert({
      where: { userId },
      create: {
        userId,
        baseUrl: 'https://mock-api.test',
        leadCreatePath: '/leads',
        authHeaderName: 'X-API-Key',
        authFormat: 'ApiKey',
        apiKeyEncrypted,
        isEnabled: true,
      },
      update: { apiKeyEncrypted, isEnabled: true },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        (
          url: string,
          opts?: { method?: string; headers?: Record<string, string>; body?: string }
        ) => {
          capturedUrl = url;
          capturedHeaders = (opts?.headers as Record<string, string>) ?? {};
          capturedBody = opts?.body ?? '';
          return Promise.resolve({
            ok: true,
            status: 201,
            text: () => Promise.resolve('{"id":"mock-lead-1"}'),
          } as Response);
        }
      )
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.kitepropIntegration.deleteMany({ where: { userId } });
  });

  it('envía POST con auth header correcto', async () => {
    const lead = await prisma.lead.create({
      data: {
        listingId,
        userId,
        channel: 'FORM',
        source: 'FEED',
        message: 'Test lead',
        status: 'PENDING',
      },
      include: {
        listing: { select: { externalId: true, title: true, price: true, currency: true } },
        user: { select: { email: true } },
        publisher: { select: { orgId: true } },
      },
    });

    const result = await deliverToKiteprop(lead as Parameters<typeof deliverToKiteprop>[0], {
      testMode: true,
    });

    expect(result.ok).toBe(true);
    expect(capturedUrl).toBe('https://mock-api.test/leads');
    expect(capturedHeaders['X-API-Key']).toBe('sk-test-12345');
    expect(capturedHeaders['Content-Type']).toBe('application/json');

    const payload = JSON.parse(capturedBody);
    expect(payload.email).toBe(TEST_USER_EMAIL);
    expect(payload.listing_id).toBe(lead.listing.externalId);
    expect(payload.message).toBeDefined();

    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
