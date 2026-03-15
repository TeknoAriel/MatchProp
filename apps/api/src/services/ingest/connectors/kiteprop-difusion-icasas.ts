/**
 * Conector Kiteprop Difusión iCasas (JSON).
 * URL desde IngestSourceConfig (sourcesJson.icasas[0].url) o env KITEPROP_DIFUSION_ICASAS_URL.
 * Fixture: KITEPROP_DIFUSION_ICASAS_MODE=fixture lee desde fixtures/icasas-sample.json.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/icasas-sample.json');
const LOCATION_MAX = 200;
const DEFAULT_URL = 'https://www.kiteprop.com/difusions/icasas';

async function getIcasasUrl(): Promise<string> {
  const envUrl = process.env.KITEPROP_DIFUSION_ICASAS_URL;
  if (envUrl) return envUrl;
  const row = await prisma.ingestSourceConfig.findUnique({
    where: { id: 'default' },
  });
  const json = (row?.sourcesJson as Record<string, { url?: string }[]>) ?? {};
  const arr = json.icasas;
  if (Array.isArray(arr) && arr[0]?.url) return String(arr[0].url);
  return DEFAULT_URL;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartamento: 'APARTMENT',
  casa: 'HOUSE',
  oficina: 'OFFICE',
  terreno: 'LAND',
  local: 'OFFICE',
  otro: 'OTHER',
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

function icasasToRaw(item: Record<string, unknown>): Record<string, unknown> {
  const imagenes = Array.isArray(item.imagenes) ? (item.imagenes as string[]) : [];
  return {
    id: item.codigo,
    title: item.titulo,
    description: item.descripcion,
    operation_type: item.operacion,
    property_type: item.tipo,
    price: item.precio_usd,
    currency: 'USD',
    bedrooms: item.habitaciones,
    bathrooms: item.banos,
    area_total: item.metros_cuadrados,
    latitude: item.latitud,
    longitude: item.longitud,
    address: item.direccion,
    location_text: item.localidad || item.direccion,
    publisher_ref: item.agente_id,
    status: item.activo === true ? 'activo' : 'inactivo',
    updated_at: item.fecha_actualizacion,
    images: imagenes.map((url, i) => ({ url: String(url), order: i })),
  };
}

export function createKitepropDifusionIcasasConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_ICASAS_MODE === 'fixture';

  return {
    source: 'KITEPROP_DIFUSION_ICASAS' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      if (useFixture) {
        const raw = readFileSync(FIXTURE_PATH, 'utf-8');
        const arr = JSON.parse(raw) as Record<string, unknown>[];
        const items = arr.map(icasasToRaw);
        const start = cursor ? parseInt(cursor, 10) || 0 : 0;
        const slice = items.slice(start, start + limit);
        const nextCursor =
          start + slice.length < items.length ? String(start + slice.length) : null;
        return { items: slice, nextCursor };
      }

      const url = await getIcasasUrl();
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`iCasas difusion fetch failed: ${res.status}`);
      const arr = (await res.json()) as Record<string, unknown>[];
      const items = Array.isArray(arr) ? arr.map(icasasToRaw) : [];
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
      const op = String(raw.operation_type ?? 'venta').toLowerCase();
      const pt = String(raw.property_type ?? 'apartamento').toLowerCase();
      const status = String(raw.status ?? 'activo').toLowerCase();
      const locationText = trunc(
        (raw.location_text as string) ||
          (raw.localidad as string) ||
          (raw.address as string) ||
          null
      );

      return {
        source: 'KITEPROP_DIFUSION_ICASAS' as ListingSource,
        externalId: id,
        publisherRef: raw.publisher_ref ? String(raw.publisher_ref) : null,
        status: status === 'inactivo' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.description ? String(raw.description) : null,
        operationType: op === 'alquiler' || op === 'rent' ? 'RENT' : 'SALE',
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
