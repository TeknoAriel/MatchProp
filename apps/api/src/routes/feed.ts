import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { encodeListingCursor, decodeListingCursor } from '../lib/cursor.js';
import { getCachedTotal, setCachedTotal } from '../lib/feed-total-cache-provider.js';
import { amenityFiltersToAndList } from '../lib/amenity-filter.js';
import { locationTextToPrismaClause } from '../lib/location-filter.js';
import { mergeListingQualityWhere } from '../lib/listing-quality-where.js';
import { feedItemWithRawJsonFallback } from '../lib/feed-listing-card.js';

const FEED_LIMIT_DEFAULT = 20;
const FEED_LIMIT_MAX = 50;
const VALID_OPERATIONS = ['SALE', 'RENT'] as const;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;
const VALID_CURRENCIES = ['USD', 'ARS'] as const;
const LOCATION_TEXT_MAX_LEN = 200;

const listingCardMediaItemSchema = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    sortOrder: { type: 'integer' },
    type: { type: 'string', description: 'PHOTO | VIDEO' },
  },
  required: ['url', 'sortOrder'],
};

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
    media: { type: 'array', items: listingCardMediaItemSchema },
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
/** Amenidades Zonaprop filtrables (caracteristicas booleanas) */
const AMENITIES_OPTIONS = [
  'pileta',
  'parrilla',
  'quincho',
  'gimnasio',
  'cochera',
  'cocheras',
  'jardín',
  'terraza',
  'balcón',
  'aire acondicionado',
  'calefacción',
  'chimenea',
  'ascensor',
  'SUM',
  'hidromasaje',
  'sauna',
  'vigilancia',
  'internet wifi',
  'alarma',
  'baulera',
  'amoblado',
] as const;

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
  /** Palabras que deben aparecer en título o descripción (AND entre palabras). */
  keywords?: string[];
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
  /** soft = amenities no van a WHERE (default MatchProp); strict = AND en SQL */
  amenitiesMode?: 'strict' | 'soft';
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

/** Default MatchProp: soft (amenities no destruyen inventario). */
function parseAmenitiesMode(q: Record<string, unknown>): 'strict' | 'soft' | undefined {
  const raw = q.amenitiesMode ?? q.amenities_mode;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'strict') return 'strict';
    if (s === 'soft') return 'soft';
  }
  if (q.amenitiesStrict === '1' || q.amenitiesStrict === 'true' || q.amenitiesStrict === true)
    return 'strict';
  return undefined;
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
  const keywordsRaw = q.keywords;
  let keywords: string[] | undefined;
  if (typeof keywordsRaw === 'string' && keywordsRaw.trim()) {
    keywords = keywordsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 80)
      .slice(0, 12);
    if (keywords.length === 0) keywords = undefined;
  } else if (Array.isArray(keywordsRaw)) {
    keywords = keywordsRaw
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 80)
      .slice(0, 12);
    if (keywords.length === 0) keywords = undefined;
  }
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
    keywords,
    amenitiesMode: parseAmenitiesMode(q),
  };
}

/** Solo enum válido en DB; descarta strings viejos o basura del JSON guardado */
function sanitizeSavedPropertyTypes(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const arr = raw.filter(
    (v): v is string =>
      typeof v === 'string' &&
      VALID_PROPERTY_TYPES.includes(v as (typeof VALID_PROPERTY_TYPES)[number])
  );
  return arr.length ? arr : undefined;
}

/** JSON guardado puede traer `propertyType` como array (SearchFilters) o string suelto legado. */
function propertyTypesFromSavedFiltersJson(f: Record<string, unknown>): unknown {
  const pt = f.propertyType;
  const pts = f.propertyTypes;
  if (Array.isArray(pt)) return pt;
  if (
    typeof pt === 'string' &&
    VALID_PROPERTY_TYPES.includes(pt as (typeof VALID_PROPERTY_TYPES)[number])
  ) {
    return [pt];
  }
  if (Array.isArray(pts)) return pts;
  return null;
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
        propertyTypes: sanitizeSavedPropertyTypes(
          Array.isArray(p.propertyTypes)
            ? p.propertyTypes
            : Array.isArray(p.propertyType)
              ? p.propertyType
              : undefined
        ),
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
        source: (p.source as string) ?? undefined,
        aptoCredito: p.aptoCredito === true ? true : undefined,
        amenities: Array.isArray(p.amenities) ? (p.amenities as string[]) : undefined,
        photosCountMin: typeof p.photosCountMin === 'number' ? p.photosCountMin : undefined,
        listingAgeDays: typeof p.listingAgeDays === 'number' ? p.listingAgeDays : undefined,
        keywords: Array.isArray(p.keywords)
          ? (p.keywords as unknown[])
              .filter((x): x is string => typeof x === 'string')
              .map((s) => s.trim())
              .filter((s) => s.length >= 2)
              .slice(0, 12)
          : undefined,
        amenitiesMode:
          p.amenitiesMode === 'strict' || p.amenitiesMode === 'soft'
            ? (p.amenitiesMode as 'strict' | 'soft')
            : undefined,
      }
    : {};
  const mergedTypes = overrides.propertyTypes ?? base.propertyTypes;
  return {
    operationType: overrides.operationType ?? base.operationType,
    propertyTypes: sanitizeSavedPropertyTypes(mergedTypes),
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
    // Solo el querystring define orden explícito; sin sortBy en URL → date_desc en el handler (no heredar JSON guardado).
    sortBy: overrides.sortBy,
    source: overrides.source ?? base.source,
    aptoCredito: overrides.aptoCredito ?? base.aptoCredito,
    amenities: overrides.amenities ?? base.amenities,
    photosCountMin: overrides.photosCountMin ?? base.photosCountMin,
    listingAgeDays: overrides.listingAgeDays ?? base.listingAgeDays,
    keywords: overrides.keywords ?? base.keywords,
    minLat: overrides.minLat ?? (typeof p?.minLat === 'number' ? p.minLat : undefined),
    maxLat: overrides.maxLat ?? (typeof p?.maxLat === 'number' ? p.maxLat : undefined),
    minLng: overrides.minLng ?? (typeof p?.minLng === 'number' ? p.minLng : undefined),
    maxLng: overrides.maxLng ?? (typeof p?.maxLng === 'number' ? p.maxLng : undefined),
    amenitiesMode: overrides.amenitiesMode ?? base.amenitiesMode,
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
  if (f.locationText) {
    const loc = locationTextToPrismaClause(f.locationText);
    if (loc) where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), loc];
  }
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
  const amenitiesStrict = f.amenitiesMode === 'strict';
  if (amenitiesStrict && f.amenities?.length) {
    const andList = amenityFiltersToAndList(f.amenities);
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

/**
 * Relaja filtros por pasos acumulativos antes de caer al catálogo completo.
 * No se quitan tipo de propiedad ni operación: el usuario los expresó de forma explícita.
 * Tampoco locationText/addressText (macro ubicación textual).
 *
 * Orden: amenities y “preferidos” → secundarios → flexibles (dorm/baños/superficie) → precio → bounds mapa.
 */
function relaxFeedFiltersAccum(base: FeedFilters, step: number): FeedFilters {
  const f: FeedFilters = { ...base };
  if (step >= 1) {
    f.amenities = undefined;
    f.amenitiesMode = undefined;
    f.photosCountMin = undefined;
    f.listingAgeDays = undefined;
    f.keywords = undefined;
    f.titleContains = undefined;
    f.descriptionContains = undefined;
  }
  if (step >= 2) {
    f.aptoCredito = undefined;
    f.areaCoveredMin = undefined;
  }
  if (step >= 3) {
    f.bedrooms = undefined;
    f.bedroomsMax = undefined;
    f.bathrooms = undefined;
    f.bathroomsMax = undefined;
    f.areaMin = undefined;
    f.areaMax = undefined;
  }
  if (step >= 4) {
    f.priceMin = undefined;
    f.priceMax = undefined;
    f.currency = undefined;
  }
  if (step >= 5) {
    f.minLat = undefined;
    f.maxLat = undefined;
    f.minLng = undefined;
    f.maxLng = undefined;
  }
  return f;
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
            amenitiesMode: {
              type: 'string',
              enum: ['strict', 'soft'],
              description: 'strict = amenities en SQL; soft (default) = preferencia, no WHERE',
            },
            amenitiesStrict: { type: 'string', description: '1/true = mismo efecto que amenitiesMode=strict' },
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
              matchTier: {
                type: 'string',
                enum: ['exact', 'relaxed', 'catalog'],
                description: 'exact | relajado | catálogo general',
              },
              relaxAppliedStep: {
                type: ['integer', 'null'],
                description: 'Paso de relajación 1–5 si matchTier=relaxed',
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
        areaCoveredMin?: number | null;
        locationText?: string | null;
        addressText?: string | null;
        titleContains?: string | null;
        descriptionContains?: string | null;
        keywords?: unknown;
        sortBy?: string | null;
        source?: string | null;
        amenities?: string[] | null;
        aptoCredito?: boolean | null;
        photosCountMin?: number | null;
        listingAgeDays?: number | null;
        amenitiesMode?: 'strict' | 'soft' | null;
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
            propertyTypes: propertyTypesFromSavedFiltersJson(f),
            bedroomsMin: typeof f.bedroomsMin === 'number' ? f.bedroomsMin : null,
            bedroomsMax: typeof f.bedroomsMax === 'number' ? f.bedroomsMax : null,
            bathroomsMin: typeof f.bathroomsMin === 'number' ? f.bathroomsMin : null,
            bathroomsMax: typeof f.bathroomsMax === 'number' ? f.bathroomsMax : null,
            areaMin: typeof f.areaMin === 'number' ? f.areaMin : null,
            areaMax: typeof f.areaMax === 'number' ? f.areaMax : null,
            locationText: (f.locationText as string) ?? null,
            addressText: (f.addressText as string) ?? null,
            titleContains: (f.titleContains as string) ?? null,
            descriptionContains: (f.descriptionContains as string) ?? null,
            keywords: f.keywords ?? null,
            sortBy: (f.sortBy as string) ?? null,
            source: (f.source as string) ?? null,
            amenities: Array.isArray(f.amenities) ? f.amenities : null,
            aptoCredito: f.aptoCredito === true ? true : null,
            areaCoveredMin: typeof f.areaCoveredMin === 'number' ? f.areaCoveredMin : null,
            photosCountMin: typeof f.photosCountMin === 'number' ? f.photosCountMin : null,
            listingAgeDays: typeof f.listingAgeDays === 'number' ? f.listingAgeDays : null,
            amenitiesMode:
              f.amenitiesMode === 'strict' || f.amenitiesMode === 'soft'
                ? (f.amenitiesMode as 'strict' | 'soft')
                : null,
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

      const sortBy = filters.sortBy ?? 'date_desc';
      const isDateSort = sortBy === 'date_desc';
      const legacyLastSeenCursor =
        !!cursorData && isDateSort && !cursorData.createdAt && !!cursorData.lastSeenAt;

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
              : legacyLastSeenCursor
                ? [{ lastSeenAt: 'desc' as const }, { id: 'desc' as const }]
                : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

      const listingSelect = {
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
        createdAt: true,
        lastSeenAt: true,
        media: {
          orderBy: { sortOrder: 'asc' as const },
          take: 6,
          select: { url: true, sortOrder: true, type: true },
        },
      } as const;

      function buildFindWhere(base: Record<string, unknown>): Record<string, unknown> {
        const fw = { ...base } as Record<string, unknown>;
        if (cursorData) {
          if (isDateSort && cursorData.createdAt) {
            fw.OR = [
              { createdAt: { lt: cursorData.createdAt } },
              { createdAt: cursorData.createdAt, id: { lt: cursorData.id } },
            ];
          } else if (isDateSort && cursorData.lastSeenAt) {
            fw.OR = [
              { lastSeenAt: { lt: cursorData.lastSeenAt } },
              { lastSeenAt: cursorData.lastSeenAt, id: { lt: cursorData.id } },
            ];
          } else if (cursorData.lastSeenAt) {
            fw.OR = [
              { lastSeenAt: { lt: cursorData.lastSeenAt } },
              { lastSeenAt: cursorData.lastSeenAt, id: { lt: cursorData.id } },
            ];
          }
        }
        return fw;
      }

      const includeTotal = parseIntParam(q.includeTotal) === 1;
      const hasCursor = !!cursorData;
      const relaxMaxStep = 5;
      const relaxStepRaw =
        !feedAll && cursorData && typeof cursorData.relaxStep === 'number'
          ? Math.floor(cursorData.relaxStep)
          : null;
      const relaxStepFromCursor =
        relaxStepRaw != null && relaxStepRaw >= 1 ? Math.min(relaxStepRaw, relaxMaxStep) : null;

      let activeFilters =
        relaxStepFromCursor != null ? relaxFeedFiltersAccum(filters, relaxStepFromCursor) : filters;
      /** Se reenvía en nextCursor para que la página siguiente use los mismos filtros efectivos. */
      let cursorRelaxStepForNext: number | null = relaxStepFromCursor;

      let baseWhere: Record<string, unknown> = {
        status: 'ACTIVE',
        swipeDecisions: { none: { userId: user.userId } },
        ...filtersToWhere(activeFilters),
      };
      mergeListingQualityWhere(baseWhere);
      let findWhere = buildFindWhere(baseWhere);

      let total: number | null = null;
      if (hasCursor) {
        total = (await getCachedTotal(user.userId, filters as Record<string, unknown>)) ?? null;
      } else if (includeTotal) {
        const count = await prisma.listing.count({ where: baseWhere });
        total = count;
        await setCachedTotal(user.userId, filters as Record<string, unknown>, count);
      } else {
        total = (await getCachedTotal(user.userId, filters as Record<string, unknown>)) ?? null;
      }

      let itemsRaw = await prisma.listing.findMany({
        where: findWhere,
        take: limit + 1,
        orderBy,
        select: listingSelect,
      });

      let fallbackUsed = false;
      const hasRestrictiveFilters =
        filters.operationType != null ||
        (filters.propertyTypes?.length ?? 0) > 0 ||
        filters.priceMin != null ||
        filters.priceMax != null ||
        filters.bedrooms != null ||
        filters.bathrooms != null ||
        filters.areaMin != null ||
        (filters.locationText != null && filters.locationText.trim() !== '') ||
        (filters.addressText != null && filters.addressText.trim() !== '') ||
        (filters.descriptionContains != null && filters.descriptionContains.trim() !== '') ||
        (filters.titleContains != null && filters.titleContains.trim() !== '') ||
        (filters.keywords?.length ?? 0) > 0 ||
        (filters.amenities?.length ?? 0) > 0 ||
        filters.minLat != null ||
        filters.maxLat != null ||
        filters.minLng != null ||
        filters.maxLng != null;

      if (itemsRaw.length === 0 && !hasCursor && !feedAll && hasRestrictiveFilters) {
        for (let step = 1; step <= relaxMaxStep; step++) {
          const rf = relaxFeedFiltersAccum(filters, step);
          const bw: Record<string, unknown> = {
            status: 'ACTIVE',
            swipeDecisions: { none: { userId: user.userId } },
            ...filtersToWhere(rf),
          };
          mergeListingQualityWhere(bw);
          const fw = buildFindWhere(bw);
          const tryRaw = await prisma.listing.findMany({
            where: fw,
            take: limit + 1,
            orderBy,
            select: listingSelect,
          });
          if (tryRaw.length > 0) {
            itemsRaw = tryRaw;
            activeFilters = rf;
            baseWhere = bw;
            findWhere = fw;
            fallbackUsed = true;
            cursorRelaxStepForNext = step;
            if (includeTotal) {
              total = await prisma.listing.count({ where: bw });
              await setCachedTotal(user.userId, rf as Record<string, unknown>, total);
            }
            break;
          }
        }
      }

      const hasMore = itemsRaw.length > limit;
      const items = (hasMore ? itemsRaw.slice(0, limit) : itemsRaw)
        .map((l) => feedItemWithRawJsonFallback(l))
        .filter((i) => i.id != null && i.id !== '');
      const last = items[items.length - 1];
      const lastRaw = hasMore ? itemsRaw[limit - 1] : itemsRaw[itemsRaw.length - 1];
      const nextCursor =
        hasMore && lastRaw && last
          ? isDateSort && !legacyLastSeenCursor
            ? encodeListingCursor({
                createdAt: lastRaw.createdAt,
                lastSeenAt: lastRaw.lastSeenAt,
                id: last.id,
                ...(cursorRelaxStepForNext != null ? { relaxStep: cursorRelaxStepForNext } : {}),
              })
            : encodeListingCursor({
                lastSeenAt: lastRaw.lastSeenAt,
                id: last.id,
                ...(cursorRelaxStepForNext != null ? { relaxStep: cursorRelaxStepForNext } : {}),
              })
          : null;

      const relaxAppliedStep =
        cursorRelaxStepForNext ?? relaxStepFromCursor ?? null;

      const geoPinned =
        (filters.locationText != null && filters.locationText.trim() !== '') ||
        (filters.addressText != null && filters.addressText.trim() !== '');

      /** Búsqueda por zona explícita sin resultados: no rellenar con catálogo aleatorio. */
      if (items.length === 0 && !hasCursor && !feedAll && hasRestrictiveFilters && geoPinned) {
        return {
          items: [],
          total: includeTotal ? 0 : null,
          limit,
          nextCursor: null,
          fallbackUsed: false,
          emptyCatalog: false,
          matchTier: 'exact' as const,
          relaxAppliedStep: null,
        };
      }

      /**
       * Primera página vacía (filtros de búsqueda activa, calidad, swipes, etc.):
       * devolver catálogo general con mismas reglas de calidad y swipes.
       * Antes solo ocurría si hasRestrictiveFilters; eso dejaba 0 ítems con búsqueda “vacía” o solo preferencias.
       */
      if (items.length === 0 && !hasCursor && !feedAll) {
        const fallbackWhere: Record<string, unknown> = {
          status: 'ACTIVE' as const,
          swipeDecisions: { none: { userId: user.userId } },
        };
        mergeListingQualityWhere(fallbackWhere);
        const catalogOrderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
        const fallbackRaw = await prisma.listing.findMany({
          where: fallbackWhere,
          take: limit + 1,
          orderBy: catalogOrderBy,
          select: listingSelect,
        });
        let fbTotal: number | null = null;
        if (includeTotal) {
          fbTotal = await prisma.listing.count({ where: fallbackWhere });
        }
        const fbHasMore = fallbackRaw.length > limit;
        const fbItems = (fbHasMore ? fallbackRaw.slice(0, limit) : fallbackRaw)
          .map((l) => feedItemWithRawJsonFallback(l))
          .filter((i) => i.id != null && i.id !== '');
        const fbLast = fbItems[fbItems.length - 1];
        const fbLastRaw = fbHasMore ? fallbackRaw[limit - 1] : fallbackRaw[fallbackRaw.length - 1];
        const fbNextCursor =
          fbHasMore && fbLastRaw && fbLast
            ? encodeListingCursor({
                createdAt: fbLastRaw.createdAt,
                lastSeenAt: fbLastRaw.lastSeenAt,
                id: fbLast.id,
              })
            : null;
        return {
          items: fbItems,
          total: fbTotal,
          limit,
          nextCursor: fbNextCursor,
          fallbackUsed: true,
          emptyCatalog: fbItems.length === 0,
          matchTier: 'catalog' as const,
          relaxAppliedStep: null,
        };
      }

      const emptyCatalog = items.length === 0 && !hasCursor;
      return {
        items,
        total,
        limit,
        nextCursor,
        fallbackUsed,
        emptyCatalog,
        matchTier: relaxAppliedStep != null ? ('relaxed' as const) : ('exact' as const),
        relaxAppliedStep,
      };
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
            feed: {
              type: 'string',
              description: 'all = ignorar búsqueda activa/preferencias (solo overrides)',
            },
            feedAll: { type: 'string' },
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
                      items: listingCardMediaItemSchema,
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
        areaCoveredMin?: number | null;
        locationText?: string | null;
        addressText?: string | null;
        titleContains?: string | null;
        descriptionContains?: string | null;
        keywords?: unknown;
        sortBy?: string | null;
        source?: string | null;
        amenities?: string[] | null;
        aptoCredito?: boolean | null;
        photosCountMin?: number | null;
        listingAgeDays?: number | null;
        amenitiesMode?: 'strict' | 'soft' | null;
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
            propertyTypes: propertyTypesFromSavedFiltersJson(f),
            bedroomsMin: typeof f.bedroomsMin === 'number' ? f.bedroomsMin : null,
            bedroomsMax: typeof f.bedroomsMax === 'number' ? f.bedroomsMax : null,
            bathroomsMin: typeof f.bathroomsMin === 'number' ? f.bathroomsMin : null,
            bathroomsMax: typeof f.bathroomsMax === 'number' ? f.bathroomsMax : null,
            areaMin: typeof f.areaMin === 'number' ? f.areaMin : null,
            areaMax: typeof f.areaMax === 'number' ? f.areaMax : null,
            locationText: (f.locationText as string) ?? null,
            addressText: (f.addressText as string) ?? null,
            titleContains: (f.titleContains as string) ?? null,
            descriptionContains: (f.descriptionContains as string) ?? null,
            keywords: f.keywords ?? null,
            sortBy: (f.sortBy as string) ?? null,
            source: (f.source as string) ?? null,
            amenities: Array.isArray(f.amenities) ? f.amenities : null,
            aptoCredito: f.aptoCredito === true ? true : null,
            areaCoveredMin: typeof f.areaCoveredMin === 'number' ? f.areaCoveredMin : null,
            photosCountMin: typeof f.photosCountMin === 'number' ? f.photosCountMin : null,
            listingAgeDays: typeof f.listingAgeDays === 'number' ? f.listingAgeDays : null,
            amenitiesMode:
              f.amenitiesMode === 'strict' || f.amenitiesMode === 'soft'
                ? (f.amenitiesMode as 'strict' | 'soft')
                : null,
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
      const filters = feedAll ? mergeFilters(null, overrides) : mergeFilters(pref, overrides);
      const fw = filtersToWhere(filters);
      const baseWhere: Record<string, unknown> = {
        status: 'ACTIVE',
        swipeDecisions: { none: { userId: user.userId } },
        ...fw,
        lat: fw.lat ?? { not: null },
        lng: fw.lng ?? { not: null },
      };
      mergeListingQualityWhere(baseWhere);

      const mapSelect = {
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
          orderBy: { sortOrder: 'asc' as const },
          take: 6,
          select: { url: true, sortOrder: true, type: true },
        },
      } as const;

      function mapRowsToItems(
        rows: {
          id: string;
          lat: number | null;
          lng: number | null;
          title: string | null;
          price: number | null;
          locationText: string | null;
          heroImageUrl: string | null;
          rawJson: unknown;
          areaTotal: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          currency: string | null;
          operationType: string | null;
          source: string;
          publisherRef: string | null;
          media: { url: string; sortOrder: number; type: string | null }[];
        }[]
      ) {
        return rows
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
      }

      let itemsRaw = await prisma.listing.findMany({
        where: baseWhere,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: mapSelect,
      });

      let items = mapRowsToItems(itemsRaw);

      if (items.length === 0 && !feedAll) {
        const filtersOpen = mergeFilters(null, overrides);
        const fwOpen = filtersToWhere(filtersOpen);
        const baseOpen: Record<string, unknown> = {
          status: 'ACTIVE',
          swipeDecisions: { none: { userId: user.userId } },
          ...fwOpen,
          lat: fwOpen.lat ?? { not: null },
          lng: fwOpen.lng ?? { not: null },
        };
        mergeListingQualityWhere(baseOpen);
        itemsRaw = await prisma.listing.findMany({
          where: baseOpen,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: mapSelect,
        });
        items = mapRowsToItems(itemsRaw);
      }

      return reply.send({ items });
    }
  );
}
