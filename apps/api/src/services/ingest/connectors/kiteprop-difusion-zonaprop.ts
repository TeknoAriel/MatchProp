import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/zonaprop-sample.xml');
const LOCATION_MAX = 200;
const DEFAULT_URL = 'https://www.kiteprop.com/difusions/zonaprop';

const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'APARTMENT',
  house: 'HOUSE',
  office: 'OFFICE',
  land: 'LAND',
  other: 'OTHER',
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

function getTagContent(xml: string, tag: string): string | null {
  const re = new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>', 'i');
  const m = xml.match(re);
  return m && m[1] !== undefined ? m[1].trim() || null : null;
}

function getTagAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp('<' + tag + '[^>]*\\s' + attr + '=["\']([^"\']*)["\']', 'i');
  const m = xml.match(re);
  return m && m[1] !== undefined ? m[1].trim() || null : null;
}

function parseZonapropXml(buffer: string): Record<string, unknown>[] {
  const listings: Record<string, unknown>[] = [];
  const listingBlocks = buffer.match(/<listing[^>]*>[\s\S]*?<\/listing>/gi) || [];
  for (const block of listingBlocks) {
    const id = getTagAttr(block, 'listing', 'id') || getTagContent(block, 'id');
    if (!id) continue;
    const images: { url: string; order: number }[] = [];
    const imageRegex = /<image\s+url="([^"]+)"[^>]*\/?>/gi;
    let imgMatch;
    let order = 0;
    while ((imgMatch = imageRegex.exec(block)) !== null) {
      images.push({ url: imgMatch[1] ?? '', order });
      order += 1;
    }
    listings.push({
      id,
      title: getTagContent(block, 'title'),
      description: getTagContent(block, 'description'),
      operation_type: (getTagContent(block, 'operation_type') || 'sale').toLowerCase(),
      property_type: (getTagContent(block, 'property_type') || 'apartment').toLowerCase(),
      price: getTagContent(block, 'price'),
      currency: (getTagContent(block, 'currency') || 'USD').toUpperCase(),
      bedrooms: getTagContent(block, 'bedrooms'),
      bathrooms: getTagContent(block, 'bathrooms'),
      area_total: getTagContent(block, 'area_total'),
      latitude: getTagContent(block, 'latitude'),
      longitude: getTagContent(block, 'longitude'),
      address: getTagContent(block, 'address'),
      location_text: getTagContent(block, 'location_text') || getTagContent(block, 'address'),
      publisher_ref: getTagContent(block, 'publisher_ref'),
      status: (getTagContent(block, 'status') || 'active').toLowerCase(),
      updated_at: getTagContent(block, 'updated_at'),
      images,
    });
  }
  return listings;
}

export function createKitepropDifusionZonapropConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_ZONAPROP_MODE === 'fixture';

  return {
    source: 'KITEPROP_DIFUSION_ZONAPROP' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      if (useFixture) {
        const xml = readFileSync(FIXTURE_PATH, 'utf-8');
        const items = parseZonapropXml(xml);
        const start = cursor ? parseInt(cursor, 10) || 0 : 0;
        const slice = items.slice(start, start + limit);
        const nextCursor =
          start + slice.length < items.length ? String(start + slice.length) : null;
        return { items: slice, nextCursor };
      }
      const res = await fetch(DEFAULT_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error('Zonaprop difusion fetch failed: ' + res.status);
      const text = await res.text();
      const items = parseZonapropXml(text);
      const start = cursor ? parseInt(cursor, 10) || 0 : 0;
      const slice = items.slice(start, start + limit);
      const nextCursor = start + slice.length < items.length ? String(start + slice.length) : null;
      return { items: slice, nextCursor };
    },
    normalize: (raw) => {
      const id = String(raw.id ?? '');
      const images = Array.isArray(raw.images)
        ? (raw.images as { url?: string; order?: number }[])
        : [];
      const op = String(raw.operation_type ?? 'sale').toLowerCase();
      const pt = String(raw.property_type ?? 'apartment').toLowerCase();
      const status = String(raw.status ?? 'active').toLowerCase();
      const locationText = trunc((raw.location_text as string) || (raw.address as string) || null);
      return {
        source: 'KITEPROP_DIFUSION_ZONAPROP' as ListingSource,
        externalId: id,
        publisherRef: raw.publisher_ref ? String(raw.publisher_ref) : null,
        status: status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.description ? String(raw.description) : null,
        operationType: op === 'rent' ? 'RENT' : 'SALE',
        propertyType: PROPERTY_TYPE_MAP[pt] ?? 'APARTMENT',
        currency: raw.currency ? String(raw.currency).toUpperCase() : 'USD',
        price: parseNum(raw.price),
        bedrooms: parseNum(raw.bedrooms),
        bathrooms: parseNum(raw.bathrooms),
        areaTotal: parseNum(raw.area_total),
        lat: parseNum(raw.latitude),
        lng: parseNum(raw.longitude),
        addressText: raw.address ? String(raw.address) : null,
        locationText,
        updatedAtSource: raw.updated_at ? new Date(String(raw.updated_at)) : null,
        mediaUrls: images
          .filter((img) => img?.url)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((img, i) => ({ url: String(img.url), sortOrder: i })),
      };
    },
  };
}
