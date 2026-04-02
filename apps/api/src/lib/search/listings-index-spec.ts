/**
 * Especificación del índice de búsqueda para catálogos grandes (20k–200k+ listings).
 * Implementación prevista: Elasticsearch 8+ u OpenSearch 2.x.
 *
 * Flujo recomendado:
 * 1. Postgres sigue siendo source of truth (Listing + ListingMedia).
 * 2. Jobs de ingest / cron indexan documentos (bulk API, refresh_interval 5–30s).
 * 3. GET /feed y búsquedas avanzadas leen IDs + sort desde ES, hidratan cards vía Prisma por lote.
 *
 * Ver docs/SCALABILITY.md sección «Motor de búsqueda».
 */

/** Nombre del índice; sobreescribible por entorno. */
export const LISTINGS_SEARCH_INDEX =
  process.env.ELASTICSEARCH_INDEX_LISTINGS?.trim() || 'matchprop-listings';

/**
 * Mapping orientativo (ES). Ajustar analyzers (español: `spanish` o `icu_folding`).
 * Campos `nested` para media si se filtra por cantidad de fotos en índice.
 */
export const listingsIndexMappingProperties = {
  id: { type: 'keyword' },
  status: { type: 'keyword' },
  source: { type: 'keyword' },
  publisherRef: { type: 'keyword' },
  publisherId: { type: 'keyword' },
  operationType: { type: 'keyword' },
  propertyType: { type: 'keyword' },
  currency: { type: 'keyword' },
  price: { type: 'double' },
  bedrooms: { type: 'integer' },
  bathrooms: { type: 'integer' },
  areaTotal: { type: 'double' },
  areaCovered: { type: 'double' },
  lat: { type: 'double' },
  lng: { type: 'double' },
  photosCount: { type: 'integer' },
  lastSeenAt: { type: 'date' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
  title: { type: 'text', analyzer: 'standard' },
  description: { type: 'text', analyzer: 'standard' },
  locationText: { type: 'text', fields: { raw: { type: 'keyword' } } },
  addressText: { type: 'text' },
  /** Copia plana de amenities / flags usados en filtros (ej. aptoCredito). */
  detailsFlat: { type: 'flattened' },
} as const;

export type ListingsSearchBackendMode = 'postgres' | 'elasticsearch';

/** Modo de búsqueda de catálogo; hoy solo se usa `postgres` en runtime. */
export function getListingsSearchBackend(): ListingsSearchBackendMode {
  const v = process.env.SEARCH_BACKEND?.trim().toLowerCase();
  if (v === 'elasticsearch' || v === 'es' || v === 'opensearch') return 'elasticsearch';
  return 'postgres';
}
