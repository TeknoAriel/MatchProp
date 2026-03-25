/**
 * Motor reutilizable del feed. Usado por /feed y /searches/:id/results.
 */
import { prisma } from './prisma.js';
import { encodeListingCursor, decodeListingCursor } from './cursor.js';
import { getCachedTotal, setCachedTotal } from './feed-total-cache.js';
import { extractFromRawJson } from './rawjson-fallback.js';
import type { SearchFilters } from '@matchprop/shared';

/** Entrada alineada con filtros del GET /feed (filtersToWhere). */
export type FeedFiltersInput = {
  operationType?: string;
  propertyType?: string[];
  propertyTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  bedrooms?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  bathrooms?: number;
  bathroomsMin?: number;
  bathroomsMax?: number;
  areaMin?: number;
  areaMax?: number;
  areaCoveredMin?: number;
  locationText?: string;
  addressText?: string;
  titleContains?: string;
  descriptionContains?: string;
  sortBy?: 'date_desc' | 'price_asc' | 'price_desc' | 'area_desc';
  source?: string;
  aptoCredito?: boolean;
  amenities?: string[];
  photosCountMin?: number;
  listingAgeDays?: number;
  keywords?: string[];
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
};

export function filtersToWhere(f: FeedFiltersInput): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.operationType) where.operationType = f.operationType;
  const pt = f.propertyType ?? f.propertyTypes;
  if (pt?.length) where.propertyType = { in: pt };
  if (f.priceMin != null || f.priceMax != null) {
    const pf: { gte?: number; lte?: number } = {};
    if (f.priceMin != null) pf.gte = f.priceMin;
    if (f.priceMax != null) pf.lte = f.priceMax;
    where.price = pf;
  }
  if (f.currency) where.currency = f.currency;
  const bedsMin = f.bedrooms ?? f.bedroomsMin;
  if (bedsMin != null || f.bedroomsMax != null) {
    const bf: { gte?: number; lte?: number } = {};
    if (bedsMin != null) bf.gte = bedsMin;
    if (f.bedroomsMax != null) bf.lte = f.bedroomsMax;
    where.bedrooms = bf;
  }
  const bathsMin = f.bathrooms ?? f.bathroomsMin;
  if (bathsMin != null || f.bathroomsMax != null) {
    const bf: { gte?: number; lte?: number } = {};
    if (bathsMin != null) bf.gte = bathsMin;
    if (f.bathroomsMax != null) bf.lte = f.bathroomsMax;
    where.bathrooms = bf;
  }
  if (f.areaMin != null || f.areaMax != null) {
    const af: { gte?: number; lte?: number } = {};
    if (f.areaMin != null) af.gte = f.areaMin;
    if (f.areaMax != null) af.lte = f.areaMax;
    where.areaTotal = af;
  }
  if (f.areaCoveredMin != null) where.areaCovered = { gte: f.areaCoveredMin };
  if (f.locationText) where.locationText = { contains: f.locationText, mode: 'insensitive' };
  if (f.addressText) where.addressText = { contains: f.addressText, mode: 'insensitive' };
  if (f.titleContains) where.title = { contains: f.titleContains, mode: 'insensitive' };
  if (f.descriptionContains)
    where.description = { contains: f.descriptionContains, mode: 'insensitive' };
  if (f.source) where.source = f.source;
  if (f.photosCountMin != null && f.photosCountMin >= 0) {
    where.photosCount = { gte: f.photosCountMin };
  }
  if (f.listingAgeDays != null && f.listingAgeDays >= 1) {
    const since = new Date();
    since.setDate(since.getDate() - f.listingAgeDays);
    where.lastSeenAt = { gte: since };
  }
  if (f.aptoCredito === true) {
    where.AND = [
      ...((where.AND as Record<string, unknown>[]) ?? []),
      { details: { path: ['aptoCredito'], equals: true } },
    ];
  }
  if (f.amenities?.length) {
    const andList: Record<string, unknown>[] = [];
    for (const amenity of f.amenities) {
      const amenityNorm = String(amenity).trim();
      if (!amenityNorm) continue;
      andList.push({
        OR: [
          { description: { contains: amenityNorm, mode: 'insensitive' } },
          { title: { contains: amenityNorm, mode: 'insensitive' } },
          { details: { path: ['amenities'], array_contains: [amenityNorm] } },
        ],
      });
    }
    if (andList.length)
      where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), ...andList];
  }
  if (f.keywords?.length) {
    const andKw: Record<string, unknown>[] = [];
    for (const kw of f.keywords) {
      const k = String(kw).trim();
      if (!k) continue;
      andKw.push({
        OR: [
          { title: { contains: k, mode: 'insensitive' } },
          { description: { contains: k, mode: 'insensitive' } },
        ],
      });
    }
    if (andKw.length) where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), ...andKw];
  }
  if (f.minLat != null || f.maxLat != null || f.minLng != null || f.maxLng != null) {
    const latCond: { not?: null; gte?: number; lte?: number } = { not: null };
    if (f.minLat != null) latCond.gte = f.minLat;
    if (f.maxLat != null) latCond.lte = f.maxLat;
    const lngCond: { not?: null; gte?: number; lte?: number } = { not: null };
    if (f.minLng != null) lngCond.gte = f.minLng;
    if (f.maxLng != null) lngCond.lte = f.maxLng;
    where.lat = latCond;
    where.lng = lngCond;
  }
  return where;
}

function searchFiltersToFeedFilters(s: SearchFilters): FeedFiltersInput {
  return {
    operationType: s.operationType,
    propertyType: s.propertyType,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    currency: s.currency,
    bedroomsMin: s.bedroomsMin,
    bedroomsMax: s.bedroomsMax,
    bathroomsMin: s.bathroomsMin,
    bathroomsMax: s.bathroomsMax,
    areaMin: s.areaMin,
    areaMax: s.areaMax,
    areaCoveredMin: s.areaCoveredMin,
    locationText: s.locationText,
    addressText: s.addressText,
    titleContains: s.titleContains,
    descriptionContains: s.descriptionContains,
    sortBy: s.sortBy,
    source: s.source,
    aptoCredito: s.aptoCredito,
    amenities: s.amenities,
    photosCountMin: s.photosCountMin,
    listingAgeDays: s.listingAgeDays,
    keywords: s.keywords,
    minLat: s.minLat,
    maxLat: s.maxLat,
    minLng: s.minLng,
    maxLng: s.maxLng,
  };
}

/** Campos exclusivos de SearchFilters frente al querystring plano del feed. */
function isSearchFiltersShape(f: object): boolean {
  const k = f as Record<string, unknown>;
  return (
    'bedroomsMin' in k ||
    'bedroomsMax' in k ||
    'bathroomsMax' in k ||
    'areaMax' in k ||
    'areaCoveredMin' in k ||
    'addressText' in k ||
    'titleContains' in k ||
    'descriptionContains' in k ||
    'sortBy' in k ||
    'source' in k ||
    'photosCountMin' in k ||
    'listingAgeDays' in k ||
    'keywords' in k ||
    'minLat' in k ||
    'maxLat' in k ||
    'minLng' in k ||
    'maxLng' in k
  );
}

export function toFeedFiltersInput(filters: FeedFiltersInput | SearchFilters): FeedFiltersInput {
  if (isSearchFiltersShape(filters)) {
    return searchFiltersToFeedFilters(filters as SearchFilters);
  }
  const legacy = filters as FeedFiltersInput;
  return {
    ...legacy,
    propertyType: legacy.propertyType ?? legacy.propertyTypes,
  };
}

function orderByForSort(sortBy: FeedFiltersInput['sortBy']) {
  const s = sortBy ?? 'date_desc';
  if (s === 'price_asc')
    return [{ price: 'asc' as const }, { lastSeenAt: 'desc' as const }, { id: 'desc' as const }];
  if (s === 'price_desc')
    return [{ price: 'desc' as const }, { lastSeenAt: 'desc' as const }, { id: 'desc' as const }];
  if (s === 'area_desc')
    return [
      { areaTotal: 'desc' as const },
      { lastSeenAt: 'desc' as const },
      { id: 'desc' as const },
    ];
  return [{ lastSeenAt: 'desc' as const }, { id: 'desc' as const }];
}

/**
 * Verifica si un listing matchea los filtros (mismo criterio que el feed).
 * Usado por el runner de alertas PRICE_DROP y BACK_ON_MARKET.
 */
export async function listingMatchesFilters(
  listingId: string,
  filters: FeedFiltersInput | SearchFilters
): Promise<boolean> {
  const f = toFeedFiltersInput(filters);

  const baseWhere = {
    id: listingId,
    status: 'ACTIVE' as const,
    ...filtersToWhere(f),
  };

  const count = await prisma.listing.count({ where: baseWhere });
  return count === 1;
}

export async function executeFeed(params: {
  userId: string;
  limit: number;
  cursor?: string | null;
  includeTotal?: boolean;
  filters: FeedFiltersInput | SearchFilters;
  excludeSwipes?: boolean;
  /** Solo listings con lastSeenAt > since (para alertas) */
  since?: Date;
}) {
  const { userId, limit, cursor, includeTotal, excludeSwipes = true, since } = params;
  const filters = toFeedFiltersInput(params.filters);

  const cursorData = decodeListingCursor(cursor ?? undefined);
  if (cursor !== undefined && cursor !== null && String(cursor).trim() !== '' && !cursorData) {
    return { error: 'INVALID_CURSOR' as const };
  }

  const baseWhere: Record<string, unknown> = {
    status: 'ACTIVE',
    ...(excludeSwipes ? { swipeDecisions: { none: { userId } } } : {}),
    ...(since ? { lastSeenAt: { gt: since } } : {}),
    ...filtersToWhere(filters),
  };

  const findWhere = { ...baseWhere } as Record<string, unknown>;
  if (cursorData) {
    findWhere.OR = [
      { lastSeenAt: { lt: cursorData.lastSeenAt } },
      { lastSeenAt: cursorData.lastSeenAt, id: { lt: cursorData.id } },
    ];
  }

  const hasCursor = !!cursorData;
  let total: number | null = null;
  if (hasCursor) {
    total = getCachedTotal(userId, filters as Record<string, unknown>) ?? null;
  } else if (includeTotal) {
    const count = await prisma.listing.count({ where: baseWhere });
    total = count;
    setCachedTotal(userId, filters as Record<string, unknown>, count);
  } else {
    total = getCachedTotal(userId, filters as Record<string, unknown>) ?? null;
  }

  const orderBy = orderByForSort(filters.sortBy);

  const itemsRaw = await prisma.listing.findMany({
    where: findWhere,
    take: limit + 1,
    orderBy,
    select: {
      id: true,
      title: true,
      price: true,
      currency: true,
      bedrooms: true,
      bathrooms: true,
      areaTotal: true,
      locationText: true,
      heroImageUrl: true,
      rawJson: true,
      publisherRef: true,
      source: true,
      operationType: true,
      lastSeenAt: true,
      media: {
        orderBy: { sortOrder: 'asc' },
        take: 6,
        select: { url: true, sortOrder: true },
      },
    },
  });

  const hasMore = itemsRaw.length > limit;
  const items = (hasMore ? itemsRaw.slice(0, limit) : itemsRaw).map((l) => {
    let heroImageUrl =
      l.heroImageUrl ?? (l as { media?: { url: string }[] }).media?.[0]?.url ?? null;
    let title = l.title;
    if ((!heroImageUrl || !title?.trim()) && l.rawJson) {
      const fb = extractFromRawJson(l.rawJson);
      if (!heroImageUrl) heroImageUrl = fb.heroImageUrl;
      if (!title?.trim()) title = fb.title;
    }
    return {
      id: l.id,
      title,
      price: l.price ? Math.round(l.price) : null,
      currency: l.currency,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      areaTotal: l.areaTotal ? Math.round(l.areaTotal) : null,
      locationText: l.locationText,
      heroImageUrl,
      publisherRef: l.publisherRef,
      source: l.source,
      operationType: l.operationType,
    };
  });
  const lastRaw = hasMore ? itemsRaw[limit - 1] : itemsRaw[itemsRaw.length - 1];
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && lastRaw && last
      ? encodeListingCursor({ lastSeenAt: lastRaw.lastSeenAt, id: last.id })
      : null;

  return { items, total, limit, nextCursor };
}
