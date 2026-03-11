import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/kiteprop-sample.json');

export function createKitepropFixtureConnector(): SourceConnector {
  return {
    source: 'KITEPROP' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      const raw = readFileSync(FIXTURE_PATH, 'utf-8');
      const items = JSON.parse(raw) as Record<string, unknown>[];
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = items.slice(start, start + limit);
      const nextCursor = start + slice.length < items.length ? String(start + slice.length) : null;
      return { items: slice, nextCursor };
    },
    normalize: (raw) => {
      const id = String(raw.id ?? '');
      const photos = Array.isArray(raw.photos) ? (raw.photos as string[]) : [];
      const op = String(raw.operation ?? 'SALE').toUpperCase();
      const pt = String(raw.propertyType ?? 'APARTMENT').toUpperCase();
      return {
        source: 'KITEPROP' as ListingSource,
        externalId: id,
        publisherRef: raw.publisherRef ? String(raw.publisherRef) : null,
        status: raw.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.description ? String(raw.description) : null,
        operationType: op === 'RENT' ? 'RENT' : 'SALE',
        propertyType: ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'].includes(pt)
          ? pt
          : 'APARTMENT',
        currency: raw.currency ? String(raw.currency) : 'USD',
        price: typeof raw.price === 'number' ? raw.price : null,
        bedrooms: typeof raw.bedrooms === 'number' ? raw.bedrooms : null,
        bathrooms: typeof raw.bathrooms === 'number' ? raw.bathrooms : null,
        areaTotal: typeof raw.areaTotal === 'number' ? raw.areaTotal : null,
        lat: typeof raw.lat === 'number' ? raw.lat : null,
        lng: typeof raw.lng === 'number' ? raw.lng : null,
        addressText: raw.address ? String(raw.address) : null,
        locationText: raw.address ? String(raw.address).trim().slice(0, 200) : null,
        updatedAtSource: raw.updatedAt ? new Date(String(raw.updatedAt)) : null,
        mediaUrls: photos.map((url, i) => ({ url: String(url), sortOrder: i })),
      };
    },
  };
}
