import type { ListingSource } from '@prisma/client';

export interface RawListing {
  [key: string]: unknown;
}

/** Campos de ficha que pueden venir del JSON Kiteprop (amenities, aptoCredito, etc.) */
export interface ListingDetailsFromIngest {
  amenities?: string[];
  aptoCredito?: boolean;
  pileta?: boolean;
  cochera?: boolean;
  jardin?: boolean;
  parrilla?: boolean;
  gimnasio?: boolean;
  [key: string]: unknown;
}

export interface NormalizedListing {
  source: ListingSource;
  externalId: string;
  publisherRef?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  title?: string | null;
  description?: string | null;
  operationType?: string | null;
  propertyType?: string | null;
  currency?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaTotal?: number | null;
  areaCovered?: number | null;
  lat?: number | null;
  lng?: number | null;
  addressText?: string | null;
  locationText?: string | null;
  updatedAtSource?: Date | null;
  mediaUrls?: { url: string; sortOrder: number; type?: string | null }[];
  details?: ListingDetailsFromIngest | null;
}

export interface FetchBatchParams {
  cursor?: string | null;
  limit: number;
  /** If-None-Match para GET condicional (catálogo JSON estático) */
  ifNoneMatch?: string | null;
}

export interface FetchBatchResult {
  items: RawListing[];
  nextCursor: string | null;
  /** ETag de la respuesta 200 (o el conocido si 304 con cache) */
  etag?: string | null;
  /** Catálogo remoto sin cambios (304 al inicio del archivo); no tocar DB ni cursor */
  feedUnchanged?: boolean;
  /** El archivo remoto cambió de ETag respecto al sync anterior; el conector reinició offset a 0 */
  catalogReset?: boolean;
}

export interface SourceConnector {
  source: ListingSource;
  fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult>;
  normalize(raw: RawListing): NormalizedListing & {
    mediaUrls?: { url: string; sortOrder: number; type?: string | null }[];
  };
  /**
   * Si true, al terminar el sync (nextCursor null) se marcan INACTIVE los listings
   * de esta fuente cuyo externalId no esté en el JSON acumulado en el sync.
   */
  fullCatalogTombstone?: boolean;
}
