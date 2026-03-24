import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { encodeListingCursor, decodeListingCursor } from '../lib/cursor.js';
import { getCachedTotal, setCachedTotal } from '../lib/feed-total-cache.js';
import { extractFromRawJson } from '../lib/rawjson-fallback.js';

const FEED_LIMIT_DEFAULT = 20;
const FEED_LIMIT_MAX = 50;
const VALID_OPERATIONS = ['SALE', 'RENT'] as const;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;
const VALID_CURRENCIES = ['USD', 'ARS'] as const;
const LOCATION_TEXT_MAX_LEN = 200;

/** Schema ListingCard (card liviana) */
const listingCardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: ['string', 'null'] },
    price: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    bedrooms: { type: ['integer', 'null'] },
    bathrooms: { type: ['integer', 'null'] },
    areaTotal: { type: ['number', 'null'] },
    locationText: { type: ['string', 'null'] },
    heroImageUrl: { type: ['string', 'null'] },
    publisherRef: { type: ['string', 'null'] },
    source: { type: 'string' },
    operationType: { type: ['string', 'null'] },
  },
};

const error400Schema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    code: { type: 'string', enum: ['INVALID_CURSOR', 'INVALID_LIMIT', 'INVALID_FILTERS'] },
  },
};

const VALID_SORT = ['date_desc', 'price_asc', 'price_desc', 'area_desc'] as const;
const AMENITIES_OPTIONS = ['SUM', 'quincho', 'parrilla', 'cocheras', 'pileta', 'gimnasio'] as const;

/** Aplica rawJson fallback cuando heroImageUrl o title faltan en el listing */
function feedItemWithRawJsonFallback(l: {
  id: string;
  title: string | null;
  heroImageUrl: string | null;
  media?: { url: string; sortOrder: number }[];
  rawJson?: unknown;
  price?: number | null;
  currency?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaTotal?: number | null;
  locationText?: string | null;
  publisherRef?: string | null;
  source?: string;
  operationType?: string | null;
  lastSeenAt?: Date;
}) {
  let heroImageUrl = l.heroImageUrl ?? l.media?.[0]?.url ?? null;
  let title = l.title;
  let media = l.media;
  if ((!heroImageUrl || !title?.trim()) && l.rawJson) {
    const fb = extractFromRawJson(l.rawJson);
    if (!heroImageUrl) heroImageUrl = fb.heroImageUrl;
    if (!title?.trim()) title = fb.title;
    if (!media?.length && fb.mediaUrls.length) {
      media = fb.mediaUrls.map((m) => ({ url: m.url, sortOrder: m.sortOrder }));
    }
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
    media: Array.isArray(media)
      ? media.map((m) => ({ url: m.url, sortOrder: m.sortOrder }))
      : undefined,
    publisherRef: l.publisherRef,
    source: l.source,
    operationType: l.operationType,
  };
}

type FeedFilters = {
  operationType?: string;
  propertyTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  bedrooms?: number;
  bedroomsMax?: number;
  bathrooms?: number;
  bathroomsMax?: number;
  areaMin?: number;
  areaMax?: number;
  areaCoveredMin?: number;
  locationText?: string;
  addressText?: string;
  titleContains?: string;
  descriptionContains?: string;
  sortBy?: (typeof VALID_SORT)[number];
  source?: string;
  aptoCredito?: boolean;
  amenities?: string[];
  photosCountMin?: number;
  listingAgeDays?: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
};

function parsePropertyTypes(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    const arr = val.filter(
      (v) =>
        typeof v === 'string' &&
        VALID_PROPERTY_TYPES.includes(v as (typeof VALID_PROPERTY_TYPES)[number])
    );
    return arr.length ? arr : undefined;
  }
  if (typeof val === 'string') {
    const arr = val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => VALID_PROPERTY_TYPES.includes(s as (typeof VALID_PROPERTY_TYPES)[number]));
    return arr.length ? arr : undefined;
  }
  return undefined;
}

function parseIntParam(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Math.floor(Number(val));
  return Number.isNaN(n) ? undefined : n;
}

function parseFloatParam(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

function parseAmenities(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    const arr = val.filter(
      (v) =>
        typeof v === 'string' && AMENITIES_OPTIONS.includes(v as (typeof AMENITIES_OPTIONS)[number])
    );
    return arr.length ? arr : undefined;
  }
  if (typeof val === 'string') {
    const arr = val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => AMENITIES_OPTIONS.includes(s as (typeof AMENITIES_OPTIONS)[number]));
    return arr.length ? arr : undefined;
  }
  return undefined;
}

function parseFeedQuery(q: Record<string, unknown>): FeedFilters {
  const operationType =
    typeof q.operationType === 'string' &&
    VALID_OPERATIONS.includes(q.operationType as (typeof VALID_OPERATIONS)[number])
      ? q.operationType
      : typeof q.operation === 'string' &&
          VALID_OPERATIONS.includes(q.operation as (typeof VALID_OPERATIONS)[number])
        ? q.operation
        : undefined;
  const currency =
    typeof q.currency === 'string' &&
    VALID_CURRENCIES.includes(q.currency as (typeof VALID_CURRENCIES)[number])
      ? q.currency
      : undefined;
  const loc =
    typeof q.locationText === 'string' ? q.locationText.trim().slice(0, LOCATION_TEXT_MAX_LEN) : '';
  const titleContains =
    typeof q.titleContains === 'string' ? q.titleContains.trim().slice(0, 100) : undefined;
  const descriptionContains =
    typeof q.descriptionContains === 'string'
      ? q.descriptionContains.trim().slice(0, 200)
      : undefined;
  const addressText =
    typeof q.addressText === 'string'
      ? q.addressText.trim().slice(0, LOCATION_TEXT_MAX_LEN)
      : undefined;
  const sortBy =
    typeof q.sortBy === 'string' && VALID_SORT.includes(q.sortBy as (typeof VALID_SORT)[number])
      ? (q.sortBy as (typeof VALID_SORT)[number])
      : undefined;
  const source = typeof q.source === 'string' && q.source.trim() ? q.source.trim() : undefined;
  const aptoCredito = q.aptoCredito === '1' || q.aptoCredito === 'true' ? true : undefined;
  const photosCountMin = parseIntParam(q.photosCountMin);
  const listingAgeDays = parseIntParam(q.listingAgeDays ?? q.listingAge);
  return {
    operationType,
    propertyTypes: parsePropertyTypes(q.propertyType ?? q.propertyTypes),
    priceMin: parseIntParam(q.priceMin ?? q.minPrice),
    priceMax: parseIntParam(q.priceMax ?? q.maxPrice),
    currency,
    bedrooms: parseIntParam(q.bedrooms ?? q.bedroomsMin),
    bedroomsMax: parseIntParam(q.bedroomsMax),
    bathrooms: parseIntParam(q.bathrooms ?? q.bathroomsMin),
    bathroomsMax: parseIntParam(q.bathroomsMax),
    areaMin: parseIntParam(q.areaMin),
    areaMax: parseIntParam(q.areaMax),
    areaCoveredMin: parseIntParam(q.areaCoveredMin),
    locationText: loc || undefined,
    addressText: addressText || undefined,
    titleContains: titleContains || undefined,
    descriptionContains: descriptionContains || undefined,
    sortBy,
    source,
    aptoCredito,
    amenities: parseAmenities(q.amenities ?? q.amenity),
    photosCountMin: photosCountMin != null && photosCountMin >= 0 ? photosCountMin : undefined,
    listingAgeDays:
      listingAgeDays != null && listingAgeDays >= 1 && listingAgeDays <= 365
        ? listingAgeDays
        : undefined,
    minLat: parseFloatParam(q.minLat),
    maxLat: parseFloatParam(q.maxLat),
    minLng: parseFloatParam(q.minLng),
    maxLng: parseFloatParam(q.maxLng),
  };
}

function mergeFilters(
  pref: {
    operation?: string | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    currency?: string | null;
    propertyTypes?: unknown;
    bedroomsMin?: number | null;
    bedroomsMax?: number | null;
    bathroomsMin?: number | null;
    bathroomsMax?: number | null;
    areaMin?: number | null;
    areaMax?: number | null;
    locationText?: string | null;
  } | null,
  overrides: FeedFilters
): FeedFilters {
  const p = pref as Record<string, unknown> | null;
  const base = p
    ? {
        operationType: (p.operation ?? p.operationType) as string | undefined,
        propertyTypes: Array.isArray(p.propertyTypes)
          ? (p.propertyTypes as string[])
          : Array.isArray(p.propertyType)
            ? (p.propertyType as string[])
            : undefined,
        priceMin:
          typeof p.priceMin === 'number'
            ? p.priceMin
            : typeof p.minPrice === 'number'
              ? p.minPrice
              : undefined,
        priceMax:
          typeof p.priceMax === 'number'
            ? p.priceMax
            : typeof p.maxPrice === 'number'
              ? p.maxPrice
              : undefined,
        currency: (p.currency as string) ?? undefined,
        bedrooms:
          typeof p.bedroomsMin === 'number'
            ? p.bedroomsMin
            : typeof p.bedrooms === 'number'
              ? p.bedrooms
              : undefined,
        bedroomsMax: typeof p.bedroomsMax === 'number' ? p.bedroomsMax : undefined,
        bathrooms:
          typeof p.bathroomsMin === 'number'
            ? p.bathroomsMin
            : typeof p.bathrooms === 'number'
              ? p.bathrooms
              : undefined,
        bathroomsMax: typeof p.bathroomsMax === 'number' ? p.bathroomsMax : undefined,
        areaMin: typeof p.areaMin === 'number' ? p.areaMin : undefined,
        areaMax: typeof p.areaMax === 'number' ? p.areaMax : undefined,
        areaCoveredMin: typeof p.areaCoveredMin === 'number' ? p.areaCoveredMin : undefined,
        locationText: (p.locationText as string) ?? undefined,
        addressText: (p.addressText as string) ?? undefined,
        titleContains: (p.titleContains as string) ?? undefined,
        descriptionContains: (p.descriptionContains as string) ?? undefined,
        sortBy: (p.sortBy as FeedFilters['sortBy']) ?? undefined,
        source: (p.source as string) ?? undefined,
        aptoCredito: p.aptoCredito === true ? true : undefined,
        amenities: Array.isArray(p.amenities) ? (p.amenities as string[]) : undefined,
        photosCountMin: typeof p.photosCountMin === 'number' ? p.photosCountMin : undefined,
        listingAgeDays: typeof p.listingAgeDays === 'number' ? p.listingAgeDays : undefined,
      }
    : {};
  return {
    operationType: overrides.operationType ?? base.operationType,
    propertyTypes: overrides.propertyTypes ?? base.propertyTypes,
    priceMin: overrides.priceMin ?? base.priceMin,
    priceMax: overrides.priceMax ?? base.priceMax,
    currency: overrides.currency ?? base.currency,
    bedrooms: overrides.bedrooms ?? base.bedrooms,
    bedroomsMax: overrides.bedroomsMax ?? base.bedroomsMax,
    bathrooms: overrides.bathrooms ?? base.bathrooms,
    bathroomsMax: overrides.bathroomsMax ?? base.bathroomsMax,
    areaMin: overrides.areaMin ?? base.areaMin,
    areaMax: overrides.areaMax ?? base.areaMax,
    areaCoveredMin: overrides.areaCoveredMin ?? base.areaCoveredMin,
    locationText: overrides.locationText ?? base.locationText,
    addressText: overrides.addressText ?? base.addressText,
    titleContains: overrides.titleContains ?? base.titleContains,
    descriptionContains: overrides.descriptionContains ?? base.descriptionContains,
    sortBy: overrides.sortBy ?? base.sortBy,
    source: overrides.source ?? base.source,
    aptoCredito: overrides.aptoCredito ?? base.aptoCredito,
    amenities: overrides.amenities ?? base.amenities,
    photosCountMin: overrides.photosCountMin ?? base.photosCountMin,
    listingAgeDays: overrides.listingAgeDays ?? base.listingAgeDays,
    minLat: overrides.minLat ?? (typeof p?.minLat === 'number' ? p.minLat : undefined),
    maxLat: overrides.maxLat ?? (typeof p?.maxLat === 'number' ? p.maxLat : undefined),
    minLng: overrides.minLng ?? (typeof p?.minLng === 'number' ? p.minLng : undefined),
    maxLng: overrides.maxLng ?? (typeof p?.maxLng === 'number' ? p.maxLng : undefined),
  };
}

function filtersToWhere(f: FeedFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.operationType) where.operationType = f.operationType;
  if (f.propertyTypes?.length) where.propertyType = { in: f.propertyTypes };
  if (f.priceMin != null || f.priceMax != null) {
    const pf: { gte?: number; lte?: number } = {};
    if (f.priceMin != null) pf.gte = f.priceMin;
    if (f.priceMax != null) pf.lte = f.priceMax;
    where.price = pf;
  }
  if (f.currency) where.currency = f.currency;
  if (f.bedrooms != null || f.bedroomsMax != null) {
    const bf: { gte?: number; lte?: number } = {};
    if (f.bedrooms != null) bf.gte = f.bedrooms;
    if (f.bedroomsMax != null) bf.lte = f.bedroomsMax;
    where.bedrooms = bf;
  }
  if (f.bathrooms != null || f.bathroomsMax != null) {
    const bf: { gte?: number; lte?: number } = {};
    if (f.bathrooms != null) bf.gte = f.bathrooms;
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
    where.details = { path: ['aptoCredito'], equals: true };
  }
  if (f.amenities?.length) {
    const andList: Record<string, unknown>[] = [];
    for (const amenity of f.amenities) {
      andList.push({
        OR: [
          { description: { contains: amenity, mode: 'insensitive' } },
          { title: { contains: amenity, mode: 'insensitive' } },
        ],
      });
    }
    if (andList.length)
      where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), ...andList];
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

export async function feedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/feed',
    {
      schema: {
        tags: ['Feed'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: FEED_LIMIT_DEFAULT },
            cursor: {
              type: 'string',
              description: 'Cursor opaco base64url (nextCursor de la respuesta anterior)',
            },
            includeTotal: {
              type: 'integer',
              default: 0,
              description: '1 para contar total; default 0',
            },
            searchId: {
              type: 'string',
              description: 'Filtrar por búsqueda guardada; si no se envía se usa active-search',
            },
            operationType: { type: 'string', enum: ['SALE', 'RENT'] },
            operation: { type: 'string', enum: ['SALE', 'RENT'] },
            propertyType: { type: 'string' },
            propertyTypes: { type: 'array', items: { type: 'string' } },
            priceMin: { type: 'integer' },
            priceMax: { type: 'integer' },
            minPrice: { type: 'integer' },
            maxPrice: { type: 'integer' },
            currency: { type: 'string', enum: ['USD', 'ARS'] },
            bedrooms: { type: 'integer' },
            bedroomsMin: { type: 'integer' },
            bedroomsMax: { type: 'integer' },
            bathrooms: { type: 'integer' },
            bathroomsMin: { type: 'integer' },
            bathroomsMax: { type: 'integer' },
            areaMin: { type: 'integer' },
            areaMax: { type: 'integer' },
            areaCoveredMin: { type: 'integer' },
            locationText: { type: 'string' },
            addressText: { type: 'string' },
            titleContains: { type: 'string' },
            descriptionContains: { type: 'string' },
            sortBy: { type: 'string', enum: VALID_SORT },
            source: { type: 'string' },
            aptoCredito: { type: 'string' },
            amenities: { type: 'array', items: { type: 'string' } },
            photosCountMin: { type: 'integer' },
            listingAgeDays: { type: 'integer' },
            listingAge: { type: 'integer' },
            minLat: { type: 'number', description: 'Filtro por bounds: lat mínima' },
            maxLat: { type: 'number', description: 'Filtro por bounds: lat máxima' },
            minLng: { type: 'number', description: 'Filtro por bounds: lng mínima' },
            maxLng: { type: 'number', description: 'Filtro por bounds: lng máxima' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: listingCardSchema },
              total: { type: ['integer', 'null'] },
              limit: { type: 'integer' },
              nextCursor: { type: ['string', 'null'] },
              fallbackUsed: {
                type: 'boolean',
                description:
                  'true si no hubo matches con la búsqueda activa y se devolvieron similares sin filtros',
              },
              emptyCatalog: {
                type: 'boolean',
                description:
                  'true si no hay propiedades en el catálogo; activar conexiones en Ajustes',
              },
            },
          },
          400: error400Schema,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const q = request.query as Record<string, unknown>;

      const limitRaw = q.limit;
      const limit =
        limitRaw === undefined || limitRaw === null
          ? FEED_LIMIT_DEFAULT
          : Math.floor(Number(limitRaw));
      if (limit < 1 || limit > FEED_LIMIT_MAX) {
        return reply.status(400).send({
          message: `limit debe estar entre 1 y ${FEED_LIMIT_MAX}`,
          code: 'INVALID_LIMIT',
        });
      }

      const cursorStr = q.cursor;
      const cursorData = decodeListingCursor(cursorStr as string | undefined);
      if (
        cursorStr !== undefined &&
        cursorStr !== null &&
        String(cursorStr).trim() !== '' &&
        !cursorData
      ) {
        return reply.status(400).send({
          message: 'Cursor inválido',
          code: 'INVALID_CURSOR',
        });
      }

      const querySearchId =
        typeof q.searchId === 'string' && q.searchId.trim() ? q.searchId.trim() : null;
      let pref: {
        operation?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
        currency?: string | null;
        propertyTypes?: unknown;
        bedroomsMin?: number | null;
        bedroomsMax?: number | null;
        bathroomsMin?: number | null;
        bathroomsMax?: number | null;
        areaMin?: number | null;
        areaMax?: number | null;
        locationText?: string | null;
        addressText?: string | null;
        titleContains?: string | null;
        sortBy?: string | null;
        source?: string | null;
        amenities?: string[] | null;
        photosCountMin?: number | null;
        listingAgeDays?: number | null;
      } | null = null;

      const searchIdToUse =
        querySearchId ??
        (
          await prisma.user.findUnique({
            where: { id: user.userId },
            select: { activeSearchId: true },
          })
        )?.activeSearchId ??
        null;

      if (searchIdToUse) {
        const savedSearch = await prisma.savedSearch.findFirst({
          where: { id: searchIdToUse, userId: user.userId },
        });
        if (savedSearch?.filtersJson && typeof savedSearch.filtersJson === 'object') {
          const f = savedSearch.filtersJson as Record<string, unknown>;
          pref = {
            operation: (f.operationType as string) ?? null,
            minPrice: typeof f.priceMin === 'number' ? f.priceMin : null,
            maxPrice: typeof f.priceMax === 'number' ? f.priceMax : null,
            currency: (f.currency as string) ?? null,
            propertyTypes: Array.isArray(f.propertyType)
              ? f.propertyType
              : ((f.propertyTypes as unknown) ?? null),
            bedroomsMin: typeof f.bedroomsMin === 'number' ? f.bedroomsMin : null,
            bedroomsMax: typeof f.bedroomsMax === 'number' ? f.bedroomsMax : null,
            bathroomsMin: typeof f.bathroomsMin === 'number' ? f.bathroomsMin : null,
            bathroomsMax: typeof f.bathroomsMax === 'number' ? f.bathroomsMax : null,
            areaMin: typeof f.areaMin === 'number' ? f.areaMin : null,
            areaMax: typeof f.areaMax === 'number' ? f.areaMax : null,
            locationText: (f.locationText as string) ?? null,
            addressText: (f.addressText as string) ?? null,
            titleContains: (f.titleContains as string) ?? null,
            sortBy: (f.sortBy as string) ?? null,
            source: (f.source as string) ?? null,
            amenities: Array.isArray(f.amenities) ? f.amenities : null,
            photosCountMin: typeof f.photosCountMin === 'number' ? f.photosCountMin : null,
            listingAgeDays: typeof f.listingAgeDays === 'number' ? f.listingAgeDays : null,
          };
        }
      }

      if (!pref) {
        pref = await prisma.preference.findUnique({
          where: { userId: user.userId },
        });
      }

      const feedAll = q.feed === 'all' || q.feedAll === '1';
      const overrides = parseFeedQuery(q);
      // Cuando feed=all usamos solo overrides (chips Venta/Tipo); si no hay pref usamos pref null
      const filters = feedAll ? mergeFilters(null, overrides) : mergeFilters(pref, overrides);

      if (
        filters.priceMin != null &&
        filters.priceMax != null &&
        filters.priceMin > filters.priceMax
      ) {
        return reply.status(400).send({
          message: 'minPrice/priceMin no puede ser mayor que maxPrice/priceMax',
          code: 'INVALID_FILTERS',
        });
      }

      const baseWhere: Record<string, unknown> = {
        status: 'ACTIVE',
        swipeDecisions: { none: { userId: user.userId } },
        ...filtersToWhere(filters),
      };

      const findWhere = { ...baseWhere } as Record<string, unknown>;
      if (cursorData) {
        findWhere.OR = [
          { lastSeenAt: { lt: cursorData.lastSeenAt } },
          { lastSeenAt: cursorData.lastSeenAt, id: { lt: cursorData.id } },
        ];
      }

      const includeTotal = parseIntParam(q.includeTotal) === 1;
      const hasCursor = !!cursorData;
      const sortBy = filters.sortBy ?? 'date_desc';
      const orderBy =
        sortBy === 'price_asc'
          ? [{ price: 'asc' as const }, { lastSeenAt: 'desc' as const }, { id: 'desc' as const }]
          : sortBy === 'price_desc'
            ? [{ price: 'desc' as const }, { lastSeenAt: 'desc' as const }, { id: 'desc' as const }]
            : sortBy === 'area_desc'
              ? [
                  { areaTotal: 'desc' as const },
                  { lastSeenAt: 'desc' as const },
                  { id: 'desc' as const },
                ]
              : [{ lastSeenAt: 'desc' as const }, { id: 'desc' as const }];

      let total: number | null = null;
      if (hasCursor) {
        total = getCachedTotal(user.userId, filters as Record<string, unknown>) ?? null;
      } else if (includeTotal) {
        const count = await prisma.listing.count({ where: baseWhere });
        total = count;
        setCachedTotal(user.userId, filters as Record<string, unknown>, count);
      } else {
        total = getCachedTotal(user.userId, filters as Record<string, unknown>) ?? null;
      }

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
      const items = (hasMore ? itemsRaw.slice(0, limit) : itemsRaw)
        .map((l) => feedItemWithRawJsonFallback(l))
        .filter((i) => i.id != null && i.id !== '');
      const last = items[items.length - 1];
      const lastRaw = hasMore ? itemsRaw[limit - 1] : itemsRaw[itemsRaw.length - 1];
      const nextCursor =
        hasMore && lastRaw
          ? encodeListingCursor({ lastSeenAt: lastRaw.lastSeenAt, id: last!.id })
          : null;

      const fallbackUsed = false;
      const hasRestrictiveFilters =
        filters.operationType != null ||
        (filters.propertyTypes?.length ?? 0) > 0 ||
        filters.priceMin != null ||
        filters.priceMax != null ||
        filters.bedrooms != null ||
        filters.bathrooms != null ||
        filters.areaMin != null ||
        (filters.locationText != null && filters.locationText !== '');

      if (items.length === 0 && !hasCursor && !feedAll && hasRestrictiveFilters) {
        const fallbackWhere = {
          status: 'ACTIVE' as const,
          swipeDecisions: { none: { userId: user.userId } },
        };
        const fallbackRaw = await prisma.listing.findMany({
          where: fallbackWhere,
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
        const fbHasMore = fallbackRaw.length > limit;
        const fbItems = (fbHasMore ? fallbackRaw.slice(0, limit) : fallbackRaw)
          .map((l) => feedItemWithRawJsonFallback(l))
          .filter((i) => i.id != null && i.id !== '');
        const fbLast = fbItems[fbItems.length - 1];
        const fbLastRaw = fbHasMore ? fallbackRaw[limit - 1] : fallbackRaw[fallbackRaw.length - 1];
        const fbNextCursor =
          fbHasMore && fbLastRaw && fbLast
            ? encodeListingCursor({ lastSeenAt: fbLastRaw.lastSeenAt, id: fbLast.id })
            : null;
        return {
          items: fbItems,
          total: null,
          limit,
          nextCursor: fbNextCursor,
          fallbackUsed: true,
          emptyCatalog: fbItems.length === 0,
        };
      }

      const emptyCatalog = items.length === 0 && !hasCursor;
      return { items, total, limit, nextCursor, fallbackUsed, emptyCatalog };
    }
  );

  // GET /feed/map — listings con lat/lng para vista mapa (mismos filtros que feed principal)
  fastify.get(
    '/feed/map',
    {
      schema: {
        tags: ['Feed'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            searchId: { type: 'string' },
            limit: { type: 'integer', default: 200 },
            operationType: { type: 'string', enum: ['SALE', 'RENT'] },
            locationText: { type: 'string' },
            minLat: { type: 'number', description: 'Filtro bounds: lat mínima' },
            maxLat: { type: 'number', description: 'Filtro bounds: lat máxima' },
            minLng: { type: 'number', description: 'Filtro bounds: lng mínima' },
            maxLng: { type: 'number', description: 'Filtro bounds: lng máxima' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    title: { type: ['string', 'null'] },
                    price: { type: ['number', 'null'] },
                    locationText: { type: ['string', 'null'] },
                    media: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          url: { type: 'string' },
                          sortOrder: { type: 'integer' },
                        },
                        required: ['url', 'sortOrder'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const q = request.query as Record<string, unknown>;
      const limit = Math.min(Math.floor(Number(q.limit) || 200), 300);

      const querySearchId =
        typeof q.searchId === 'string' && q.searchId.trim() ? q.searchId.trim() : null;
      let pref: {
        operation?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
        currency?: string | null;
        propertyTypes?: unknown;
        bedroomsMin?: number | null;
        bedroomsMax?: number | null;
        bathroomsMin?: number | null;
        bathroomsMax?: number | null;
        areaMin?: number | null;
        areaMax?: number | null;
        locationText?: string | null;
        addressText?: string | null;
        titleContains?: string | null;
        sortBy?: string | null;
        source?: string | null;
        amenities?: string[] | null;
        photosCountMin?: number | null;
        listingAgeDays?: number | null;
      } | null = null;

      const searchIdToUse =
        querySearchId ??
        (
          await prisma.user.findUnique({
            where: { id: user.userId },
            select: { activeSearchId: true },
          })
        )?.activeSearchId ??
        null;

      if (searchIdToUse) {
        const savedSearch = await prisma.savedSearch.findFirst({
          where: { id: searchIdToUse, userId: user.userId },
        });
        if (savedSearch?.filtersJson && typeof savedSearch.filtersJson === 'object') {
          const f = savedSearch.filtersJson as Record<string, unknown>;
          pref = {
            operation: (f.operationType as string) ?? null,
            minPrice: typeof f.priceMin === 'number' ? f.priceMin : null,
            maxPrice: typeof f.priceMax === 'number' ? f.priceMax : null,
            currency: (f.currency as string) ?? null,
            propertyTypes: Array.isArray(f.propertyType)
              ? f.propertyType
              : ((f.propertyTypes as unknown) ?? null),
            bedroomsMin: typeof f.bedroomsMin === 'number' ? f.bedroomsMin : null,
            bedroomsMax: typeof f.bedroomsMax === 'number' ? f.bedroomsMax : null,
            bathroomsMin: typeof f.bathroomsMin === 'number' ? f.bathroomsMin : null,
            bathroomsMax: typeof f.bathroomsMax === 'number' ? f.bathroomsMax : null,
            areaMin: typeof f.areaMin === 'number' ? f.areaMin : null,
            areaMax: typeof f.areaMax === 'number' ? f.areaMax : null,
            locationText: (f.locationText as string) ?? null,
            addressText: (f.addressText as string) ?? null,
            titleContains: (f.titleContains as string) ?? null,
            sortBy: (f.sortBy as string) ?? null,
            source: (f.source as string) ?? null,
            amenities: Array.isArray(f.amenities) ? f.amenities : null,
            photosCountMin: typeof f.photosCountMin === 'number' ? f.photosCountMin : null,
            listingAgeDays: typeof f.listingAgeDays === 'number' ? f.listingAgeDays : null,
          };
        }
      }

      if (!pref) {
        pref = await prisma.preference.findUnique({
          where: { userId: user.userId },
        });
      }

      const overrides = parseFeedQuery(q);
      const filters = mergeFilters(pref, overrides);
      const fw = filtersToWhere(filters);
      const baseWhere: Record<string, unknown> = {
        status: 'ACTIVE',
        swipeDecisions: { none: { userId: user.userId } },
        ...fw,
        lat: fw.lat ?? { not: null },
        lng: fw.lng ?? { not: null },
      };

      const itemsRaw = await prisma.listing.findMany({
        where: baseWhere,
        take: limit,
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          lat: true,
          lng: true,
          title: true,
          price: true,
          locationText: true,
          heroImageUrl: true,
          rawJson: true,
          areaTotal: true,
          bedrooms: true,
          bathrooms: true,
          currency: true,
          operationType: true,
          source: true,
          publisherRef: true,
          media: {
            orderBy: { sortOrder: 'asc' },
            take: 6,
            select: { url: true, sortOrder: true },
          },
        },
      });

      const items = itemsRaw
        .filter((l) => l.id && l.lat != null && l.lng != null)
        .map((l) => {
          const card = feedItemWithRawJsonFallback(l);
          return {
            id: l.id,
            lat: l.lat!,
            lng: l.lng!,
            title: card.title,
            price: card.price,
            locationText: card.locationText,
            heroImageUrl: card.heroImageUrl,
            media: card.media,
            areaTotal: l.areaTotal ? Math.round(l.areaTotal) : null,
            bedrooms: l.bedrooms ?? null,
            bathrooms: l.bathrooms ?? null,
            currency: l.currency ?? null,
            operationType: l.operationType ?? null,
            source: l.source ?? 'API_PARTNER_1',
            publisherRef: l.publisherRef ?? null,
          };
        });

      return reply.send({ items });
    }
  );
}
