/**
 * Tests de integración para listingMatchesFilters.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma.js';
import { listingMatchesFilters } from '../feed-engine.js';
import { upsertListing } from '../../services/ingest/upsert.js';
import type { NormalizedListing } from '../../services/ingest/types.js';

const SOURCE = 'API_PARTNER_1' as const;
const EXT_ID = 'listing-matches-test-' + Date.now();

/** Una foto para pasar mergeListingQualityWhere (feed/alertas). */
const SAMPLE_MEDIA = [
  { url: 'https://example.com/listing-matches-test.jpg', sortOrder: 0 },
] as const;

function norm(overrides: Partial<NormalizedListing>): NormalizedListing {
  return {
    source: SOURCE,
    externalId: EXT_ID,
    status: 'ACTIVE',
    currency: 'USD',
    price: 150000,
    bedrooms: 3,
    bathrooms: 2,
    areaTotal: 120,
    operationType: 'SALE',
    propertyType: 'APARTMENT',
    locationText: 'Palermo, CABA',
    mediaUrls: [...SAMPLE_MEDIA],
    ...overrides,
  };
}

describe('listingMatchesFilters', () => {
  let listingId: string;

  beforeAll(async () => {
    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: EXT_ID } });
    listingId = await upsertListing(norm({}));
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({ where: { source: SOURCE, externalId: EXT_ID } });
  });

  it('matchea cuando filtros coinciden', async () => {
    const ok = await listingMatchesFilters(listingId, {
      operationType: 'SALE',
      propertyType: ['APARTMENT'],
      priceMin: 100000,
      priceMax: 200000,
      currency: 'USD',
      bedroomsMin: 2,
      bathroomsMin: 1,
      areaMin: 100,
      locationText: 'Palermo',
    });
    expect(ok).toBe(true);
  });

  it('no matchea cuando priceMax es menor al listing', async () => {
    const ok = await listingMatchesFilters(listingId, {
      priceMax: 50000,
      currency: 'USD',
    });
    expect(ok).toBe(false);
  });

  it('no matchea cuando propertyType no coincide', async () => {
    const ok = await listingMatchesFilters(listingId, {
      propertyType: ['HOUSE'],
    });
    expect(ok).toBe(false);
  });
});
