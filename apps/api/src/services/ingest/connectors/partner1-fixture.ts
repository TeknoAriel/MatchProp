import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/partner1-sample.json');

export function createPartner1FixtureConnector(): SourceConnector {
  return {
    source: 'API_PARTNER_1' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      const raw = readFileSync(FIXTURE_PATH, 'utf-8');
      const items = JSON.parse(raw) as Record<string, unknown>[];
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = items.slice(start, start + limit);
      const nextCursor = start + slice.length < items.length ? String(start + slice.length) : null;
      return { items: slice, nextCursor };
    },
    normalize: (raw) => {
      const id = String(raw.external_id ?? '');
      const images = Array.isArray(raw.images)
        ? (raw.images as { url?: string; order?: number }[])
        : [];
      const op = String(raw.operation_type ?? 'sale').toLowerCase();
      const pt = String(raw.property_type ?? 'apartment').toUpperCase();
      const ptMap: Record<string, string> = {
        APARTMENT: 'APARTMENT',
        HOUSE: 'HOUSE',
        LAND: 'LAND',
        OFFICE: 'OFFICE',
        OTHER: 'OTHER',
      };
      return {
        source: 'API_PARTNER_1' as ListingSource,
        externalId: id,
        publisherRef: raw.agent_id ? String(raw.agent_id) : null,
        status: 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        operationType: op === 'rent' ? 'RENT' : 'SALE',
        propertyType: ptMap[pt] ?? 'APARTMENT',
        currency: 'USD',
        price: typeof raw.price_usd === 'number' ? raw.price_usd : null,
        bedrooms: typeof raw.bedrooms === 'number' ? raw.bedrooms : null,
        bathrooms: typeof raw.bathrooms === 'number' ? raw.bathrooms : null,
        areaTotal: typeof raw.area_m2 === 'number' ? raw.area_m2 : null,
        lat: typeof raw.latitude === 'number' ? raw.latitude : null,
        lng: typeof raw.longitude === 'number' ? raw.longitude : null,
        addressText: raw.address_text ? String(raw.address_text) : null,
        locationText: raw.address_text ? String(raw.address_text).trim().slice(0, 200) : null,
        updatedAtSource: raw.last_modified ? new Date(String(raw.last_modified)) : null,
        mediaUrls: images
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((img, i) => ({ url: String(img.url ?? ''), sortOrder: i })),
      };
    },
  };
}
