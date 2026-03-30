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

export interface FetchBatchResult {
  items: RawListing[];
  nextCursor: string | null;
}

export interface SourceConnector {
  source: ListingSource;
  fetchBatch(params: { cursor?: string | null; limit: number }): Promise<FetchBatchResult>;
  normalize(raw: RawListing): NormalizedListing & {
    mediaUrls?: { url: string; sortOrder: number; type?: string | null }[];
  };
}
