/**
 * Motor reutilizable del feed. Usado por /feed y /searches/:id/results.
 */
import { prisma } from './prisma.js';
import { encodeListingCursor, decodeListingCursor } from './cursor.js';
import { getCachedTotal, setCachedTotal } from './feed-total-cache.js';
import { extractFromRawJson } from './rawjson-fallback.js';
import type { SearchFilters } from '@matchprop/shared';

export type FeedFiltersInput = {
  operationType?: string;
  propertyType?: string[];
  propertyTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  bedrooms?: number;
  bedroomsMin?: number;
  bathrooms?: number;
  bathroomsMin?: number;
  areaMin?: number;
  locationText?: string;
  aptoCredito?: boolean;
  amenities?: string[];
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
  const beds = f.bedrooms ?? f.bedroomsMin;
  if (beds != null) where.bedrooms = { gte: beds };
  const baths = f.bathrooms ?? f.bathroomsMin;
  if (baths != null) where.bathrooms = { gte: baths };
  if (f.areaMin != null) where.areaTotal = { gte: f.areaMin };
  if (f.locationText) where.locationText = { contains: f.locationText, mode: 'insensitive' };
  if (f.aptoCredito === true) {
    where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), { details: { path: ['aptoCredito'], equals: true } }];
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
    bathroomsMin: s.bathroomsMin,
    areaMin: s.areaMin,
    locationText: s.locationText,
    aptoCredito: s.aptoCredito,
    amenities: s.amenities,
  };
}

/**
 * Verifica si un listing matchea los filtros (mismo criterio que el feed).
 * Usado por el runner de alertas PRICE_DROP y BACK_ON_MARKET.
 */
export async function listingMatchesFilters(
  listingId: string,
  filters: FeedFiltersInput | SearchFilters
): Promise<boolean> {
  const f: FeedFiltersInput =
    'propertyType' in filters || 'propertyTypes' in filters
      ? (filters as FeedFiltersInput)
      : searchFiltersToFeedFilters(filters as SearchFilters);

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
  const filters: FeedFiltersInput =
    'propertyType' in params.filters || 'propertyTypes' in params.filters
      ? (params.filters as FeedFiltersInput)
      : searchFiltersToFeedFilters(params.filters as SearchFilters);

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

  const itemsRaw = await prisma.listing.findMany({
    where: findWhere,
    take: limit + 1,
    orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
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
