/**
 * Conector Kiteprop difusión catálogo JSON (Properstar).
 * El archivo `properstar.json` comparte esquema con el histórico `yumblin.json`
 * (id, images, property_type, for_sale / for_rent, precios, agency, etc.).
 *
 * URL: `sourcesJson.properstar` o `sourcesJson.yumblin`, env
 * `KITEPROP_DIFUSION_PROPERSTAR_URL` o `KITEPROP_DIFUSION_YUMBLIN_URL` (alias),
 * o `DEFAULT_URL`.
 *
 * El `ListingSource` en Prisma sigue siendo `KITEPROP_DIFUSION_YUMBLIN` para no
 * migrar datos existentes.
 *
 * - GET condicional (`If-None-Match`): 304 al inicio del archivo → sin cambios globales.
 * - Caché en memoria por URL entre batches del mismo proceso.
 * - `fullCatalogTombstone`: el processor marca INACTIVE los IDs que ya no están en el JSON
 *   al cerrar el sync (ver processor + tombstone.ts).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/kiteprop-sample.min.json');
const DEFAULT_URL =
  'https://static.kiteprop.com/kp/difusions/f89cbd8ca785fc34317df63d29ab8ea9d68a7b1c/properstar.json';
const LOCATION_MAX = 200;

/** Array parseado del último fetch remoto exitoso (misma URL = reutilizar). */
let remoteListingArrayCache: { url: string; items: Record<string, unknown>[] } | null = null;

const PROPERTY_TYPE_MAP: Record<string, string> = {
  houses: 'HOUSE',
  apartments: 'APARTMENT',
  retail_spaces: 'OFFICE',
  residential_lands: 'LAND',
};

function normalizeEtagForCompare(etag: string | null | undefined): string | null {
  if (!etag || typeof etag !== 'string') return null;
  const t = etag.trim();
  if (!t) return null;
  return t.replace(/^W\//i, '').replace(/^"+|"+$/g, '');
}

function normalizeEtagHeader(header: string | null): string | null {
  if (!header || typeof header !== 'string') return null;
  const t = header.trim();
  return t.length ? t : null;
}

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

async function getDifusionCatalogUrl(): Promise<string> {
  const envUrl =
    process.env.KITEPROP_DIFUSION_PROPERSTAR_URL || process.env.KITEPROP_DIFUSION_YUMBLIN_URL;
  if (envUrl) return envUrl;
  const row = await prisma.ingestSourceConfig.findUnique({
    where: { id: 'default' },
  });
  const json = (row?.sourcesJson as Record<string, { url?: string }[]>) ?? {};
  const properstar = json.properstar;
  const yumblin = json.yumblin;
  if (Array.isArray(properstar) && properstar[0]?.url) return String(properstar[0].url);
  if (Array.isArray(yumblin) && yumblin[0]?.url) return String(yumblin[0].url);
  return DEFAULT_URL;
}

export function createKitepropDifusionYumblinConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_YUMBLIN_MODE === 'fixture';

  return {
    source: 'KITEPROP_DIFUSION_YUMBLIN' as ListingSource,
    /** En fixture (tests/CI) no desactivar otros listings al cerrar el sync. */
    fullCatalogTombstone: !useFixture,
    fetchBatch: async ({ cursor, limit, ifNoneMatch }) => {
      if (useFixture) {
        const raw = readFileSync(FIXTURE_PATH, 'utf-8');
        const items = JSON.parse(raw) as Record<string, unknown>[];
        const start = cursor ? parseInt(cursor, 10) || 0 : 0;
        const slice = items.slice(start, start + limit);
        const nextCursor =
          start + slice.length < items.length ? String(start + slice.length) : null;
        return { items: slice, nextCursor, etag: null };
      }

      const url = await getDifusionCatalogUrl();
      const inm = ifNoneMatch?.trim();
      const headers: Record<string, string> = {};
      if (inm) headers['If-None-Match'] = inm;

      let res = await fetch(url, { headers });

      if (res.status === 304) {
        if (remoteListingArrayCache?.url !== url) {
          res = await fetch(url);
        } else {
          const arr = remoteListingArrayCache.items;
          const atFileStart = cursor == null || cursor === '';
          if (atFileStart) {
            return {
              items: [],
              nextCursor: null,
              feedUnchanged: true,
              etag: inm ?? null,
            };
          }
          const start = parseInt(String(cursor), 10) || 0;
          const slice = arr.slice(start, start + limit);
          const nextCursor =
            start + slice.length < arr.length ? String(start + slice.length) : null;
          return { items: slice, nextCursor, etag: inm ?? null };
        }
      }

      if (!res.ok) throw new Error(`Properstar/difusión JSON fetch failed: ${res.status}`);

      const newEtagRaw = normalizeEtagHeader(res.headers.get('etag'));
      const parsed = (await res.json()) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [];
      remoteListingArrayCache = { url, items: arr };

      const catalogReset = Boolean(
        inm && newEtagRaw && normalizeEtagForCompare(inm) !== normalizeEtagForCompare(newEtagRaw)
      );
      const start = catalogReset ? 0 : cursor ? parseInt(String(cursor), 10) || 0 : 0;
      const slice = arr.slice(start, start + limit);
      const nextCursor = start + slice.length < arr.length ? String(start + slice.length) : null;
      return {
        items: slice,
        nextCursor,
        etag: newEtagRaw ?? inm ?? null,
        catalogReset,
      };
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
