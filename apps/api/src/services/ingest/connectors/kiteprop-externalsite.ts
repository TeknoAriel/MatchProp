import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/kiteprop-sample.min.json');
const LOCATION_MAX = 200;

const PROPERTY_TYPE_MAP: Record<string, string> = {
  houses: 'HOUSE',
  apartments: 'APARTMENT',
  retail_spaces: 'OFFICE',
  residential_lands: 'LAND',
};

function trunc(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  return s.trim().slice(0, LOCATION_MAX) || null;
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function buildLocationText(raw: Record<string, unknown>): string | null {
  const parts = [raw.address, raw.zone, raw.city, raw.region, raw.country].filter(
    Boolean
  ) as string[];
  const s = parts.map(String).join(', ').trim();
  return trunc(s) || trunc(String(raw.address ?? ''));
}

export function createKitepropExternalsiteConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_EXTERNALSITE_MODE === 'fixture';

  return {
    source: 'KITEPROP_EXTERNALSITE' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      if (useFixture) {
        const raw = readFileSync(FIXTURE_PATH, 'utf-8');
        const items = JSON.parse(raw) as Record<string, unknown>[];
        const start = cursor ? parseInt(cursor, 10) || 0 : 0;
        const slice = items.slice(start, start + limit);
        const nextCursor =
          start + slice.length < items.length ? String(start + slice.length) : null;
        return { items: slice, nextCursor };
      }

      const url =
        process.env.KITEPROP_EXTERNALSITE_URL ||
        'https://static.kiteprop.com/kp/difusions/4b3c894a10d905c82e85b35c410d7d4099551504/externalsite-2-9e4f284e1578b24afa155c578d05821ac4c56baa.json';

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Kiteprop externalsite fetch failed: ${res.status}`);
      const items = (await res.json()) as Record<string, unknown>[];
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = items.slice(start, start + limit);
      const nextCursor = start + slice.length < items.length ? String(start + slice.length) : null;
      return { items: slice, nextCursor };
    },
    normalize: (raw) => {
      const id = String(raw.id ?? '');
      const images = Array.isArray(raw.images) ? (raw.images as { url?: string }[]) : [];
      const pt = String(raw.property_type ?? 'apartments').toLowerCase();
      const op = raw.for_rent === true || String(raw.for_rent) === 'true' ? 'RENT' : 'SALE';
      const priceRaw = op === 'RENT' ? raw.for_rent_price : raw.for_sale_price;
      const price = parseNum(priceRaw);
      const areaTotal = parseNum(raw.total_meters) ?? parseNum(raw.covered_meters);
      const areaCovered = parseNum(raw.covered_meters);
      const agency = raw.agency as { id?: number; name?: string } | undefined;
      const publisherRef = agency?.id != null ? String(agency.id) : null;

      return {
        source: 'KITEPROP_EXTERNALSITE' as ListingSource,
        externalId: id,
        publisherRef,
        status: raw.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.content ? String(raw.content) : null,
        operationType: op,
        propertyType: PROPERTY_TYPE_MAP[pt] ?? 'APARTMENT',
        currency: raw.currency ? String(raw.currency).toUpperCase() : 'USD',
        price,
        bedrooms: typeof raw.bedrooms === 'number' ? raw.bedrooms : null,
        bathrooms: typeof raw.bathrooms === 'number' ? raw.bathrooms : null,
        areaTotal,
        areaCovered,
        lat: parseNum(raw.latitude),
        lng: parseNum(raw.longitude),
        addressText: raw.address ? String(raw.address) : null,
        locationText: buildLocationText(raw),
        updatedAtSource: raw.last_update ? new Date(String(raw.last_update)) : null,
        mediaUrls: images
          .filter((img) => img?.url)
          .map((img, i) => ({ url: String(img.url), sortOrder: i })),
      };
    },
  };
}
