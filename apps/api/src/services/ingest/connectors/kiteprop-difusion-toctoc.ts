import { readFileSync } from 'fs';
import { join } from 'path';
import type { SourceConnector } from '../types.js';
import type { ListingSource } from '@prisma/client';

const FIXTURE_PATH = join(process.cwd(), 'src/services/ingest/fixtures/toctoc-sample.json');
const LOCATION_MAX = 200;
const DEFAULT_URL = 'https://www.kiteprop.com/difusions/toctoc';

const PROPERTY_TYPE_MAP: Record<string, string> = {
  departamento: 'APARTMENT',
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

function toctocToRaw(item: Record<string, unknown>): Record<string, unknown> {
  const fotos = Array.isArray(item.fotos) ? (item.fotos as { url?: string; orden?: number }[]) : [];
  return {
    id: item.id,
    title: item.titulo,
    description: item.descripcion,
    operation_type: item.tipo_operacion,
    property_type: item.tipo_propiedad,
    price: item.precio,
    currency: item.moneda,
    bedrooms: item.dormitorios,
    bathrooms: item.banos,
    area_total: item.superficie_total,
    latitude: item.lat,
    longitude: item.lng,
    address: item.direccion,
    location_text: item.comuna || item.direccion,
    publisher_ref: item.publicador_id,
    status: item.estado,
    updated_at: item.actualizado,
    images: fotos
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((f) => ({ url: f.url ?? '', order: f.orden ?? 0 })),
  };
}

export function createKitepropDifusionToctocConnector(): SourceConnector {
  const useFixture = process.env.KITEPROP_DIFUSION_TOCTOC_MODE === 'fixture';

  return {
    source: 'KITEPROP_DIFUSION_TOCTOC' as ListingSource,
    fetchBatch: async ({ cursor, limit }) => {
      if (useFixture) {
        const raw = readFileSync(FIXTURE_PATH, 'utf-8');
        const arr = JSON.parse(raw) as Record<string, unknown>[];
        const items = arr.map(toctocToRaw);
        const start = cursor ? parseInt(cursor, 10) || 0 : 0;
        const slice = items.slice(start, start + limit);
        const nextCursor =
          start + slice.length < items.length ? String(start + slice.length) : null;
        return { items: slice, nextCursor };
      }
      const res = await fetch(DEFAULT_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error('Toctoc difusion fetch failed: ' + res.status);
      const arr = (await res.json()) as Record<string, unknown>[];
      const items = Array.isArray(arr) ? arr.map(toctocToRaw) : [];
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
      const pt = String(raw.property_type ?? 'departamento').toLowerCase();
      const status = String(raw.status ?? 'activo').toLowerCase();
      const locationText = trunc(
        (raw.location_text as string) || (raw.address as string) || (raw.comuna as string) || null
      );
      return {
        source: 'KITEPROP_DIFUSION_TOCTOC' as ListingSource,
        externalId: id,
        publisherRef: raw.publisher_ref ? String(raw.publisher_ref) : null,
        status: status === 'inactivo' ? 'INACTIVE' : 'ACTIVE',
        title: raw.title ? String(raw.title) : null,
        description: raw.description ? String(raw.description) : null,
        operationType: op === 'arriendo' || op === 'rent' ? 'RENT' : 'SALE',
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
