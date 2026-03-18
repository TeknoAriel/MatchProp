/**
 * Cliente Meilisearch para búsqueda avanzada.
 * Docs: https://www.meilisearch.com/docs
 * 
 * Para activar:
 * 1. Crear cuenta en https://cloud.meilisearch.com (tier gratis: 10K docs)
 * 2. Agregar MEILISEARCH_HOST y MEILISEARCH_API_KEY en .env
 * 3. Ejecutar: npx tsx src/scripts/setup-meilisearch.ts
 */
import { MeiliSearch, Index } from 'meilisearch';

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || '';
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY || '';

export const isMeilisearchConfigured = (): boolean => {
  return !!(MEILISEARCH_HOST && MEILISEARCH_API_KEY);
};

let meiliClient: MeiliSearch | null = null;

export function getMeiliClient(): MeiliSearch | null {
  if (!isMeilisearchConfigured()) return null;
  
  if (!meiliClient) {
    meiliClient = new MeiliSearch({
      host: MEILISEARCH_HOST,
      apiKey: MEILISEARCH_API_KEY,
    });
  }
  
  return meiliClient;
}

export function getListingsIndex(): Index | null {
  const client = getMeiliClient();
  return client ? client.index('listings') : null;
}

export interface MeiliListingDocument {
  id: string;
  title: string | null;
  description: string | null;
  operationType: string | null;
  propertyType: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  locationText: string | null;
  addressText: string | null;
  heroImageUrl: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  source: string;
  lastSeenAt: number;
}

export async function setupListingsIndex(): Promise<void> {
  const index = getListingsIndex();
  if (!index) {
    console.warn('[meilisearch] Not configured, skipping setup');
    return;
  }

  await index.updateSettings({
    searchableAttributes: [
      'title',
      'description',
      'locationText',
      'addressText',
    ],
    filterableAttributes: [
      'operationType',
      'propertyType',
      'price',
      'currency',
      'bedrooms',
      'bathrooms',
      'areaTotal',
      'status',
      'source',
      'lat',
      'lng',
    ],
    sortableAttributes: [
      'price',
      'areaTotal',
      'lastSeenAt',
      'bedrooms',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8,
      },
    },
    pagination: {
      maxTotalHits: 10000,
    },
  });

  console.log('[meilisearch] Index settings updated');
}

export async function indexListing(doc: MeiliListingDocument): Promise<void> {
  const index = getListingsIndex();
  if (!index) return;

  try {
    await index.addDocuments([doc], { primaryKey: 'id' });
  } catch (err) {
    console.warn('[meilisearch] indexListing error:', err);
  }
}

export async function deleteListing(id: string): Promise<void> {
  const index = getListingsIndex();
  if (!index) return;

  try {
    await index.deleteDocument(id);
  } catch (err) {
    console.warn('[meilisearch] deleteListing error:', err);
  }
}

export interface SearchParams {
  query?: string;
  operationType?: string;
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaMin?: number;
  areaMax?: number;
  limit?: number;
  offset?: number;
  sort?: 'price_asc' | 'price_desc' | 'date_desc' | 'area_desc';
}

export async function searchListings(params: SearchParams) {
  const index = getListingsIndex();
  if (!index) {
    return { hits: [], total: 0, processingTimeMs: 0, fallback: true };
  }

  const filters: string[] = ['status = "ACTIVE"'];

  if (params.operationType) {
    filters.push(`operationType = "${params.operationType}"`);
  }
  if (params.propertyType) {
    filters.push(`propertyType = "${params.propertyType}"`);
  }
  if (params.priceMin != null) {
    filters.push(`price >= ${params.priceMin}`);
  }
  if (params.priceMax != null) {
    filters.push(`price <= ${params.priceMax}`);
  }
  if (params.bedrooms != null) {
    filters.push(`bedrooms >= ${params.bedrooms}`);
  }
  if (params.bathrooms != null) {
    filters.push(`bathrooms >= ${params.bathrooms}`);
  }
  if (params.areaMin != null) {
    filters.push(`areaTotal >= ${params.areaMin}`);
  }
  if (params.areaMax != null) {
    filters.push(`areaTotal <= ${params.areaMax}`);
  }

  const sortMap: Record<string, string[]> = {
    price_asc: ['price:asc'],
    price_desc: ['price:desc'],
    date_desc: ['lastSeenAt:desc'],
    area_desc: ['areaTotal:desc'],
  };

  try {
    const result = await index.search(params.query || '', {
      filter: filters.join(' AND '),
      limit: params.limit || 20,
      offset: params.offset || 0,
      sort: sortMap[params.sort || 'date_desc'],
    });

    return {
      hits: result.hits as MeiliListingDocument[],
      total: result.estimatedTotalHits || 0,
      processingTimeMs: result.processingTimeMs,
      fallback: false,
    };
  } catch (err) {
    console.error('[meilisearch] search error:', err);
    return { hits: [], total: 0, processingTimeMs: 0, fallback: true };
  }
}

export async function autocomplete(query: string, limit = 5) {
  const index = getListingsIndex();
  if (!index || !query || query.length < 2) {
    return [];
  }

  try {
    const result = await index.search(query, {
      limit,
      filter: 'status = "ACTIVE"',
      attributesToRetrieve: ['id', 'title', 'locationText', 'price', 'currency', 'heroImageUrl'],
    });

    return result.hits.map(h => ({
      id: h.id as string,
      title: h.title as string | null,
      locationText: h.locationText as string | null,
      price: h.price as number | null,
      currency: h.currency as string | null,
      heroImageUrl: h.heroImageUrl as string | null,
    }));
  } catch (err) {
    console.warn('[meilisearch] autocomplete error:', err);
    return [];
  }
}
