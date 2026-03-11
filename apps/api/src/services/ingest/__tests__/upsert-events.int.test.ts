/**
 * Tests de integración: ListingEvent PRICE_CHANGED y STATUS_CHANGED durante upsert.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { upsertListing } from '../upsert.js';
import type { NormalizedListing } from '../types.js';

const SOURCE = 'API_PARTNER_1' as const;

function norm(externalId: string, overrides: Partial<NormalizedListing>): NormalizedListing {
  return {
    source: SOURCE,
    externalId,
    status: 'ACTIVE',
    currency: 'USD',
    price: null,
    ...overrides,
  };
}

describe('Upsert ListingEvent integration', () => {
  afterAll(async () => {
    await prisma.listingEvent.deleteMany({
      where: { listing: { source: SOURCE, externalId: { startsWith: 'upsert-events-' } } },
    });
    await prisma.listing.deleteMany({
      where: { source: SOURCE, externalId: { startsWith: 'upsert-events-' } },
    });
  });

  it('PRICE_CHANGED: crea evento cuando baja el precio (misma moneda)', async () => {
    const extId = 'upsert-events-price-' + Date.now();
    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: extId } });

    await upsertListing(norm(extId, { price: 120000, currency: 'USD' }));
    await upsertListing(norm(extId, { price: 110000, currency: 'USD' }));

    const events = await prisma.listingEvent.findMany({
      where: {
        listing: { source: SOURCE, externalId: extId },
        type: 'PRICE_CHANGED',
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as {
      oldPrice: number;
      newPrice: number;
      oldCurrency: string | null;
      newCurrency: string | null;
    };
    expect(payload.oldPrice).toBe(120000);
    expect(payload.newPrice).toBe(110000);
    expect(payload.oldCurrency).toBe('USD');
    expect(payload.newCurrency).toBe('USD');
  });

  it('STATUS_CHANGED: ACTIVE -> INACTIVE -> ACTIVE genera 2 eventos', async () => {
    const extId = 'upsert-events-status-' + Date.now();
    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: extId } });

    await upsertListing(norm(extId, { status: 'ACTIVE', price: 100000 }));
    await upsertListing(norm(extId, { status: 'INACTIVE', price: 100000 }));
    await upsertListing(norm(extId, { status: 'ACTIVE', price: 100000 }));

    const events = await prisma.listingEvent.findMany({
      where: {
        listing: { source: SOURCE, externalId: extId },
        type: 'STATUS_CHANGED',
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(events).toHaveLength(2);
    const p1 = events[0]!.payload as { oldStatus: string; newStatus: string };
    const p2 = events[1]!.payload as { oldStatus: string; newStatus: string };
    expect(p1.oldStatus).toBe('ACTIVE');
    expect(p1.newStatus).toBe('INACTIVE');
    expect(p2.oldStatus).toBe('INACTIVE');
    expect(p2.newStatus).toBe('ACTIVE');
  });
});
