/**
 * Tests de integración del runner de alertas: PRICE_DROP y BACK_ON_MARKET con dedupe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma.js';
import { runAlerts } from '../alerts-runner.js';
import { upsertListing } from '../../services/ingest/upsert.js';
import type { NormalizedListing } from '../../services/ingest/types.js';
import bcrypt from 'bcryptjs';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';

const USER_EMAIL = 'alerts-runner-dedupe@matchprop.com';
const SOURCE = 'API_PARTNER_1' as const;

const SAMPLE_MEDIA = [{ url: 'https://example.com/alerts-runner-test.jpg', sortOrder: 0 }] as const;

function norm(extId: string, overrides: Partial<NormalizedListing>): NormalizedListing {
  return {
    source: SOURCE,
    externalId: extId,
    status: 'ACTIVE',
    currency: 'USD',
    price: 100000,
    operationType: 'SALE',
    propertyType: 'APARTMENT',
    mediaUrls: [...SAMPLE_MEDIA],
    ...overrides,
  };
}

describe('Alerts runner PRICE_DROP and BACK_ON_MARKET dedupe', () => {
  let app: FastifyInstance;
  let userId: string;
  let searchId: string;
  let subPriceDropId: string;
  let subBackOnMarketId: string;
  let listingId: string;
  const extId = 'alerts-runner-dedupe-' + Date.now();

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    const passwordHash = await bcrypt.hash('demo', 10);
    const user = await prisma.user.upsert({
      where: { email: USER_EMAIL },
      create: { email: USER_EMAIL, passwordHash, role: 'BUYER' },
      update: { passwordHash },
    });
    userId = user.id;

    const search = await prisma.savedSearch.create({
      data: {
        userId,
        name: 'Test dedupe',
        filtersJson: { operationType: 'SALE', propertyType: ['APARTMENT'] },
      },
    });
    searchId = search.id;

    const subPrice = await prisma.alertSubscription.create({
      data: {
        userId,
        savedSearchId: searchId,
        filtersJson: { operationType: 'SALE', propertyType: ['APARTMENT'] },
        type: 'PRICE_DROP',
        isEnabled: true,
      },
    });
    subPriceDropId = subPrice.id;

    const subBack = await prisma.alertSubscription.create({
      data: {
        userId,
        savedSearchId: searchId,
        filtersJson: { operationType: 'SALE', propertyType: ['APARTMENT'] },
        type: 'BACK_ON_MARKET',
        isEnabled: true,
      },
    });
    subBackOnMarketId = subBack.id;

    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: extId } });
    listingId = await upsertListing(norm(extId, { price: 120000, currency: 'USD' }));
    await upsertListing(norm(extId, { price: 110000, currency: 'USD' }));
  });

  afterAll(async () => {
    await prisma.alertDelivery.deleteMany({
      where: {
        subscription: {
          OR: [{ id: subPriceDropId }, { id: subBackOnMarketId }],
        },
      },
    });
    await prisma.alertSubscription.deleteMany({
      where: { id: { in: [subPriceDropId, subBackOnMarketId] } },
    });
    await prisma.savedSearch.deleteMany({ where: { id: searchId } });
    await prisma.listingEvent.deleteMany({
      where: { listing: { source: SOURCE, externalId: extId } },
    });
    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: extId } });
    await app.close();
  });

  it('PRICE_DROP: corre 1 vez => 1 delivery, corre 2da vez => sigue 1 (dedupe)', async () => {
    await runAlerts();

    const d1 = await prisma.alertDelivery.findMany({
      where: { subscriptionId: subPriceDropId, type: 'PRICE_DROP' },
    });
    expect(d1.length).toBe(1);
    expect(d1[0]!.listingId).toBe(listingId);

    await runAlerts();

    const d2 = await prisma.alertDelivery.findMany({
      where: { subscriptionId: subPriceDropId, type: 'PRICE_DROP' },
    });
    expect(d2.length).toBe(1);
  });

  it('BACK_ON_MARKET: genera evento inactive->active, corre 1 vez => 1 delivery, 2da => sigue 1', async () => {
    await upsertListing(norm(extId, { status: 'INACTIVE', price: 110000 }));
    await upsertListing(norm(extId, { status: 'ACTIVE', price: 110000 }));

    await runAlerts();

    const d1 = await prisma.alertDelivery.findMany({
      where: { subscriptionId: subBackOnMarketId, type: 'BACK_ON_MARKET' },
    });
    expect(d1.length).toBe(1);
    expect(d1[0]!.listingId).toBe(listingId);

    await runAlerts();

    const d2 = await prisma.alertDelivery.findMany({
      where: { subscriptionId: subBackOnMarketId, type: 'BACK_ON_MARKET' },
    });
    expect(d2.length).toBe(1);
  });
});
