/**
 * Conector Kiteprop Difusión Yumblin (JSON).
 * URL desde IngestSourceConfig (sourcesJson.yumblin[0].url) o env KITEPROP_DIFUSION_YUMBLIN_URL.
 * Formato JSON tipo Kiteprop externalsite (id, images, property_type, for_rent, etc.).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/kiteprop-sample.min.json');
const DEFAULT_URL =
  'https://static.kiteprop.com/kp/difusions/23705a4a85ab8f1d301c73aae5359a81a8b5c1ca/yumblin.json';
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

async function getYumblinUrl(): Promise<string> {
  const envUrl = process.env.KITEPROP_DIFUSION_YUMBLIN_URL;
  if (envUrl) return envUrl;
  const row = await prisma.ingestSourceConfig.findUnique({
    where: { id: 'default' },
  });
  const json = (row?.sourcesJson as Record<string, { url?: string }[]>) ?? {};
  const arr = json.yumblin;
  if (Array.isArray(arr) && arr[0]?.url) return String(arr[0].url);
  return DEFAULT_URL;
}

export function createKitepropDifusionYumblinConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_YUMBLIN_MODE === 'fixture';

  return {
    source: 'KITEPROP_DIFUSION_YUMBLIN' as ListingSource,
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

      const url = await getYumblinUrl();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Yumblin fetch failed: ${res.status}`);
      const items = (await res.json()) as Record<string, unknown>[];
      const arr = Array.isArray(items) ? items : [];
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = arr.slice(start, start + limit);
      const nextCursor = start + slice.length < arr.length ? String(start + slice.length) : null;
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
        source: 'KITEPROP_DIFUSION_YUMBLIN' as ListingSource,
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
