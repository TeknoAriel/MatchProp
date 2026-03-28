import type { SearchFilters } from '@matchprop/shared';
import { canonicalizeAmenityToken } from '../../lib/amenity-filter.js';

const LOCATION_MAX = 200;
const TITLE_MAX = 100;
const DESC_MAX = 200;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;

/** Origen del aviso (enum Prisma ListingSource). */
const SOURCE_PHRASES: { pattern: RegExp; source: string }[] = [
  { pattern: /\bzonaprop\b/i, source: 'KITEPROP_DIFUSION_ZONAPROP' },
  { pattern: /\btoctoc\b|\btoc\s*toc\b/i, source: 'KITEPROP_DIFUSION_TOCTOC' },
  { pattern: /\bicasas\b/i, source: 'KITEPROP_DIFUSION_ICASAS' },
  { pattern: /\byumblin\b/i, source: 'KITEPROP_DIFUSION_YUMBLIN' },
  { pattern: /\bkitoprop\b|\bkiteprop\b/i, source: 'KITEPROP_API' },
  { pattern: /\bpartner\s*1\b|\bapi\s*partner\b/i, source: 'API_PARTNER_1' },
];

function trunc(s: string): string {
  return s.trim().slice(0, LOCATION_MAX) || '';
}

/** Gatillos de precio máx: hasta, menos de, presupuesto */
const PRICE_MAX_TRIGGERS =
  /hasta|máx|max|presupuesto|por\s+\d|menos\s+de|\busd\b|u\$s|\bars\b|\$|pesos|dólares|dolares/i;

/** Gatillos de precio mín: desde, mínimo, al menos */
const PRICE_MIN_TRIGGERS = /desde|m[ií]nimo|m[ií]nimo|al\s+menos|m[aá]s\s+de/i;

function parseNumberWithK(text: string, match: RegExpMatchArray): number {
  let n = parseFloat(match[1]!.replace(',', '.'));
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k' || suffix === '000') n *= 1000;
  else if (suffix === 'mil') n *= 1000;
  return Math.round(n);
}

function parsePriceMax(text: string): number | undefined {
  if (!PRICE_MAX_TRIGGERS.test(text)) return undefined;
  const lower = text.toLowerCase();
  const thousandsMatch = text.match(/(\d{1,3})[.,](\d{3})(?:\s|$|k|mil|usd|ars)/i);
  if (thousandsMatch) {
    const n = parseInt(thousandsMatch[1]! + thousandsMatch[2]!, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  const triggerMatch = lower.match(
    /(?:hasta|máx|max|presupuesto|por|menos\s+de)\s*(\d+(?:[.,]\d+)?)\s*(k|mil|000)?/i
  );
  if (triggerMatch) return parseNumberWithK(text, triggerMatch);
  const numCurrencyMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(k|mil|000)?\s*(usd|u\$s|ars|pesos|dólares|dolares)/i
  );
  if (numCurrencyMatch) return parseNumberWithK(text, numCurrencyMatch);
  const dollarMatch = text.match(/\$\s*(\d[\d.,]*)/);
  if (dollarMatch) {
    const n = parseFloat(dollarMatch[1]!.replace(/[.,]/g, (c) => (c === ',' ? '' : '.')));
    return Number.isNaN(n) ? undefined : Math.round(n);
  }
  return undefined;
}

function parsePriceMin(text: string): number | undefined {
  if (!PRICE_MIN_TRIGGERS.test(text)) return undefined;
  const m = text.match(
    /(?:desde|m[ií]nimo|al\s+menos|m[aá]s\s+de)\s*(\d+(?:[.,]\d+)?)\s*(k|mil|000)?/i
  );
  if (m) return parseNumberWithK(text, m);
  return undefined;
}

function parseBedrooms(
  text: string
): { count: number; word: 'dormitorios' | 'ambientes'; isMax?: boolean } | undefined {
  const dormMax = text.match(
    /(?:m[aá]ximo|hasta)\s*(\d+)\s*(?:dorms?|dormitorios?|dormis|habitaci[oó]ns?|habitaciones)/i
  );
  if (dormMax) return { count: parseInt(dormMax[1]!, 10), word: 'dormitorios', isMax: true };
  const ambMax = text.match(/(?:m[aá]ximo|hasta)\s*(\d+)\s*(?:amb|ambientes)/i);
  if (ambMax) return { count: parseInt(ambMax[1]!, 10), word: 'ambientes', isMax: true };
  const dormMatch = text.match(
    /(\d+)\s*(?:dorms?|dormitorios?|dormis|habitaci[oó]ns?|habitaciones)/i
  );
  if (dormMatch) return { count: parseInt(dormMatch[1]!, 10), word: 'dormitorios' };
  const ambMatch = text.match(/(\d+)\s*(?:amb|ambientes)/i);
  if (ambMatch) return { count: parseInt(ambMatch[1]!, 10), word: 'ambientes' };
  return undefined;
}

function parseBathrooms(text: string): { count: number; isMax?: boolean } | undefined {
  const maxM = text.match(/(?:m[aá]ximo|hasta)\s*(\d+)\s*(?:baño|baños|banos|bath)/i);
  if (maxM) return { count: parseInt(maxM[1]!, 10), isMax: true };
  const m = text.match(/(\d+)\s*(?:baño|baños|banos|bath)/i);
  return m ? { count: parseInt(m[1]!, 10) } : undefined;
}

function parseAreaMax(text: string): number | undefined {
  const m = text.match(/(?:m[aá]ximo|hasta)\s*(\d+)\s*(?:m2|mts2|m²|m\s*2|metros?\s*cuadrados?)/i);
  return m ? parseInt(m[1]!, 10) : undefined;
}

/** m² totales: ignora números que ya cuentan como techo (hasta/máximo N m²). */
function parseAreaMin(text: string): number | undefined {
  const withoutMax = text.replace(
    /\b(?:hasta|m[aá]ximo)\s+\d+\s*(?:m2|mts2|m²|m\s*2|metros?\s*cuadrados?)\b/gi,
    ' '
  );
  const m = withoutMax.match(/(\d+)\s*(?:m2|mts2|m²|m\s*2|metros?\s*cuadrados?)/i);
  return m ? parseInt(m[1]!, 10) : undefined;
}

function parseAreaCoveredMin(text: string): number | undefined {
  const m1 = text.match(
    /(\d+)\s*(?:m2|mts2|m²|m\s*2)\s*cubiert[oa]s?\b|\bcubiert[oa]s?\s*(?:de\s*|m[ií]n\.?\s*)?(\d+)\s*(?:m2|mts2|m²|m\s*2)/i
  );
  if (m1) {
    const n = parseInt(m1[1] || m1[2] || '', 10);
    return Number.isNaN(n) ? undefined : n;
  }
  const m2 = text.match(
    /\bsuperficie\s+cubierta\s*(?:(?:m[ií]n|mínimo|al\s+menos|desde)\s*)?(\d+)\s*(?:m2|mts2|m²|m\s*2)?/i
  );
  return m2 ? parseInt(m2[1]!, 10) : undefined;
}

function parseAddressText(text: string): string {
  const m1 = text.match(
    /\b(?:calle|av\.?|avenida|pasaje|boulevard)\s+([A-Za-záéíóúÁÉÍÓÚñÑ0-9.\s°º'-]{2,120})/i
  );
  if (m1?.[1]) return trunc(m1[1].replace(/\s+/g, ' '));
  const m2 = text.match(/\bdirecci[oó]n\s*[:\s]+\s*([^,.]{2,120})/i);
  if (m2?.[1]) return trunc(m2[1].trim());
  return '';
}

function parseTitleContains(text: string): string {
  const quoted = text.match(
    /\bt[ií]tulo\s+(?:con\s+|que\s+contenga\s+)?["""']([^"""']{2,80})["""']/i
  );
  if (quoted?.[1]) return quoted[1].trim().slice(0, TITLE_MAX);
  const q2 = text.match(/\bque\s+diga\s+["']([^"']{2,80})["']/i);
  if (q2?.[1]) return q2[1].trim().slice(0, TITLE_MAX);
  const q3 = text.match(/\ben\s+el\s+t[ií]tulo\s+["']?([^,."']{2,80})/i);
  if (q3?.[1]) return q3[1].trim().slice(0, TITLE_MAX);
  return '';
}

function parseDescriptionContains(text: string): string {
  const quoted = text.match(
    /\bdescripci[oó]n\s+(?:con\s+|que\s+contenga\s+)?["""']([^"""']{2,120})["""']/i
  );
  if (quoted?.[1]) return quoted[1].trim().slice(0, DESC_MAX);
  const q2 = text.match(/\ben\s+la\s+descripci[oó]n\s+["']?([^,."']{2,120})/i);
  if (q2?.[1]) return q2[1].trim().slice(0, DESC_MAX);
  return '';
}

function parseKeywords(text: string): string[] {
  const m = text.match(/\bpalabras?\s+clave\s*:\s*([^.;\n]+)/i);
  const raw = m?.[1] ?? /\bkeywords?\s*:\s*([^.;\n]+)/i.exec(text)?.[1] ?? '';
  if (!raw.trim()) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .slice(0, 12);
}

function parseSource(text: string): string | undefined {
  for (const { pattern, source } of SOURCE_PHRASES) {
    if (pattern.test(text)) return source;
  }
  return undefined;
}

function parseSortBy(
  text: string
): 'date_desc' | 'price_asc' | 'price_desc' | 'area_desc' | undefined {
  const lower = text.toLowerCase();
  if (
    /\bm[aá]s\s+barat[oa]s?|ordenar\s+por\s+precio\s+asc|precio\s+asc|menor\s+precio/i.test(lower)
  )
    return 'price_asc';
  if (/\bm[aá]s\s+car[oa]s?|precio\s+desc|mayor\s+precio/i.test(lower)) return 'price_desc';
  if (/\bm[aá]s\s+grandes?|por\s+metros?|área\s+desc|area\s+desc/i.test(lower)) return 'area_desc';
  if (/\bm[aá]s\s+recientes?|nuevas?|últimas?|ultimas?|por\s+fecha/i.test(lower))
    return 'date_desc';
  return undefined;
}

function parsePhotosCountMin(text: string): number | undefined {
  if (/\bcon\s+fotos?\b|\bvarias?\s+fotos?\b|\bcon\s+im[aá]genes?\b/i.test(text)) return 1;
  if (/\bcon\s+al\s+menos\s+(\d+)\s+fotos?/i.test(text)) {
    const m = text.match(/con\s+al\s+menos\s+(\d+)\s+fotos?/i);
    return m ? parseInt(m[1]!, 10) : undefined;
  }
  return undefined;
}

function parseListingAgeDays(text: string): number | undefined {
  const lower = text.toLowerCase();
  if (/\besta\s+semana\b|\búltimos?\s+7\s+d[ií]as?\b|\bultimos?\s+7\s+dias?\b/i.test(lower))
    return 7;
  if (/\besta\s+quincena\b|\b15\s+d[ií]as?\b/i.test(lower)) return 15;
  if (/\beste\s+mes\b|\búltimos?\s+30\s+d[ií]as?\b|\bultimos?\s+30\s+dias?\b/i.test(lower))
    return 30;
  if (/\bnuevas?\b|\brecientes?\b/i.test(lower)) return 7;
  return undefined;
}

function parseLocation(text: string): string {
  const patterns = [
    /en\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s+(?:casa|depto|departamento|terreno|local|oficina)|,|\.|$)/i,
    /en\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|,|\.|$)/i,
    /(zona\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|,|\.|$)/i,
    /(?:en\s+)?(Palermo|Nordelta|Microcentro|Rosario|CABA|Belgrano|Caballito|Villa\s+Crespo|Funes|Fisherton|Roldán|Córdoba|Mendoza|Pilar|Tigre|San\s+Isidro|Vicente\s+López)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const loc = trunc(m[1]);
      const stopWords = [
        'casa',
        'depto',
        'departamento',
        'terreno',
        'local',
        'oficina',
        'house',
        'apartment',
      ];
      const cleaned = loc
        .split(/\s+/)
        .filter((w) => !stopWords.includes(w.toLowerCase()))
        .join(' ');
      if (cleaned.trim()) return cleaned.trim();
    }
  }
  return '';
}

function parseOperation(text: string): 'SALE' | 'RENT' | undefined {
  const lower = text.toLowerCase();
  if (/comprar|venta|vender|for\s*sale|buy/i.test(lower) && !/alquiler|rent|arriendo/i.test(lower))
    return 'SALE';
  if (/alquiler|rent|arriendo|alquilar/i.test(lower)) return 'RENT';
  return undefined;
}

function parseCurrency(text: string): string | undefined {
  if (/\busd\b|dólar|dolar/i.test(text)) return 'USD';
  if (/\bars\b|peso|argentino/i.test(text)) return 'ARS';
  return undefined;
}

function parsePropertyType(text: string): string[] | undefined {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (/casa|house/i.test(lower)) found.push('HOUSE');
  if (/departamento|depto|apartment|ph/i.test(lower)) found.push('APARTMENT');
  if (/terreno|lote|land/i.test(lower)) found.push('LAND');
  if (/local|oficina|office|comercial/i.test(lower)) found.push('OFFICE');
  return found.length
    ? [...new Set(found)].filter((t) =>
        VALID_PROPERTY_TYPES.includes(t as (typeof VALID_PROPERTY_TYPES)[number])
      )
    : undefined;
}

/** Mapeo: término en texto → clave canónica (sinónimos vía canonicalizeAmenityToken + amenity-filter). */
const AMENITY_PATTERNS: { pattern: RegExp; key: string }[] = [
  { pattern: /\b(pileta|pilta|piscina|piletas|piscinas)\b/i, key: 'pileta' },
  {
    pattern:
      /\b(cochera|cocheras|garage|garages|estacionamiento|estacionamientos|playa\s+de\s+estacionamiento)\b/i,
    key: 'cochera',
  },
  { pattern: /\b(jard[ií]n|jardines|patio|patios)\b/i, key: 'jardín' },
  {
    pattern: /\b(parrilla|parrillas|asador|asadores|churrasquera|churrasqueras|bbq|barbacoa)\b/i,
    key: 'parrilla',
  },
  { pattern: /\b(quincho|quinchos)\b/i, key: 'quincho' },
  { pattern: /\b(gimnasio|gimnasios|gym)\b/i, key: 'gimnasio' },
  { pattern: /\b(amueblad[oa]|amoblad[oa]|muebles)\b/i, key: 'amoblado' },
  {
    pattern:
      /\b(aire\s*acondicionad[oa]s?|climatizad[oa]s?|fr[ií]o\s+calor|ac\s+split|\bsplits?\b)\b/i,
    key: 'aire acondicionado',
  },
  { pattern: /\b(calefacci[oó]n|calefaccion|caldera|radiadores)\b/i, key: 'calefacción' },
  { pattern: /\b(chimenea|chimeneas)\b/i, key: 'chimenea' },
  {
    pattern: /\b(seguridad|porter[ií]a|porteria|encargado|vigilancia\s+privada)\b/i,
    key: 'seguridad',
  },
  { pattern: /\b(ascensor|ascensores|elevador|elevadores)\b/i, key: 'ascensor' },
  { pattern: /\b(terraza|terrazas|roof\s+garden|rooftop)\b/i, key: 'terraza' },
  { pattern: /\b(balc[oó]n|balcon|balcones)\b/i, key: 'balcón' },
  { pattern: /\b(lavadero|lavaderos)\b/i, key: 'lavadero' },
  {
    pattern: /\b(SUM|sal[oó]n\s+de\s+usos\s+m[uú]ltiples|usos\s+m[uú]ltiples)\b/i,
    key: 'SUM',
  },
  { pattern: /\b(alarma|alarmas)\b/i, key: 'alarma' },
  { pattern: /\b(baulera|bauleras|dep[oó]sito|deposito|bodega)\b/i, key: 'baulera' },
  { pattern: /\b(paneles?\s+solares?|energ[ií]a\s+solar)\b/i, key: 'energía solar' },
  { pattern: /\b(mascotas?|pet\s*friendly|acepta\s+mascotas)\b/i, key: 'mascotas' },
  { pattern: /\b(hidromasaje|hidromasajes|jacuzzi|yacuzzi)\b/i, key: 'hidromasaje' },
  { pattern: /\b(sauna|saunas)\b/i, key: 'sauna' },
  { pattern: /\b(vigilancia|c[aá]maras?|circuito\s+cerrado)\b/i, key: 'vigilancia' },
  { pattern: /\b(internet\s*wifi|wi-?fi|inal[aá]mbrico)\b/i, key: 'internet wifi' },
  { pattern: /\b(solarium|sol[aá]rium)\b/i, key: 'solarium' },
];

function parseAmenities(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, key } of AMENITY_PATTERNS) {
    if (pattern.test(text)) found.add(canonicalizeAmenityToken(key));
  }
  return Array.from(found);
}

function parseAptoCredito(text: string): boolean | undefined {
  if (/\bapto\s*cr[eé]dito|\bapto\s*credito|\bcr[eé]dito\s*hipotecario\b/i.test(text)) return true;
  return undefined;
}

function hasRecognizedFilters(f: SearchFilters): boolean {
  return (
    f.operationType != null ||
    (f.propertyType?.length ?? 0) > 0 ||
    f.priceMin != null ||
    f.priceMax != null ||
    f.bedroomsMin != null ||
    f.bedroomsMax != null ||
    f.bathroomsMin != null ||
    f.bathroomsMax != null ||
    f.areaMin != null ||
    f.areaMax != null ||
    f.areaCoveredMin != null ||
    (f.locationText?.trim()?.length ?? 0) > 0 ||
    (f.addressText?.trim()?.length ?? 0) > 0 ||
    f.currency != null ||
    (f.amenities?.length ?? 0) > 0 ||
    f.aptoCredito === true ||
    f.sortBy != null ||
    f.photosCountMin != null ||
    f.listingAgeDays != null ||
    (f.keywords?.length ?? 0) > 0 ||
    (f.titleContains?.trim()?.length ?? 0) > 0 ||
    (f.descriptionContains?.trim()?.length ?? 0) > 0 ||
    f.source != null ||
    f.minLat != null ||
    f.maxLat != null ||
    f.minLng != null ||
    f.maxLng != null
  );
}

export function parseSearchText(text: string): {
  filters: SearchFilters;
  explanation: string;
  warnings: string[];
} {
  const t = text.trim();
  if (!t) {
    return {
      filters: {},
      explanation: 'No se detectó ningún criterio.',
      warnings: [
        'No entendí criterios específicos. Probá con "departamento en Palermo" o "casa hasta 100k USD".',
      ],
    };
  }

  const operation = parseOperation(t);
  const currency = parseCurrency(t);
  const priceMin = parsePriceMin(t);
  const priceMax = parsePriceMax(t);
  const bedroomsResult = parseBedrooms(t);
  const bathroomsResult = parseBathrooms(t);
  const areaMax = parseAreaMax(t);
  const areaMin = parseAreaMin(t);
  const areaCoveredMin = parseAreaCoveredMin(t);
  const locationText = parseLocation(t);
  let addressText = parseAddressText(t);
  if (
    addressText &&
    locationText &&
    addressText.toLowerCase().includes(locationText.toLowerCase())
  ) {
    addressText = '';
  }
  const titleContains = parseTitleContains(t);
  const descriptionContains = parseDescriptionContains(t);
  const keywords = parseKeywords(t);
  const source = parseSource(t);
  const propertyType = parsePropertyType(t);
  const amenities = parseAmenities(t);
  const aptoCredito = parseAptoCredito(t);
  const sortBy = parseSortBy(t);
  const photosCountMin = parsePhotosCountMin(t);
  const listingAgeDays = parseListingAgeDays(t);

  const filters: SearchFilters = {};
  if (operation) filters.operationType = operation;
  if (currency) filters.currency = currency;
  if (priceMin != null) filters.priceMin = priceMin;
  if (priceMax != null) filters.priceMax = priceMax;
  if (bedroomsResult != null) {
    if (bedroomsResult.isMax) filters.bedroomsMax = bedroomsResult.count;
    else filters.bedroomsMin = bedroomsResult.count;
  }
  if (bathroomsResult != null) {
    if (bathroomsResult.isMax) filters.bathroomsMax = bathroomsResult.count;
    else filters.bathroomsMin = bathroomsResult.count;
  }
  if (areaMin != null) filters.areaMin = areaMin;
  if (areaMax != null) filters.areaMax = areaMax;
  if (areaCoveredMin != null) filters.areaCoveredMin = areaCoveredMin;
  if (locationText) filters.locationText = locationText;
  if (addressText) filters.addressText = addressText;
  if (titleContains) filters.titleContains = titleContains;
  if (descriptionContains) filters.descriptionContains = descriptionContains;
  if (keywords.length) filters.keywords = keywords;
  if (source) filters.source = source;
  if (propertyType?.length) filters.propertyType = propertyType;
  if (amenities.length) filters.amenities = amenities;
  if (aptoCredito === true) filters.aptoCredito = aptoCredito;
  if (sortBy) filters.sortBy = sortBy;
  if (photosCountMin != null) filters.photosCountMin = photosCountMin;
  if (listingAgeDays != null) filters.listingAgeDays = listingAgeDays;

  const parts: string[] = [];
  if (operation) parts.push(operation === 'SALE' ? 'venta' : 'alquiler');
  if (propertyType?.length) parts.push(propertyType.map((p) => p.toLowerCase()).join(' o '));
  if (locationText) parts.push(`en ${locationText}`);
  if (priceMin != null) {
    parts.push(`desde ${priceMin.toLocaleString()}${currency ? ` ${currency}` : ''}`);
  }
  if (priceMax) {
    parts.push(
      currency
        ? `hasta ${priceMax.toLocaleString()} ${currency}`
        : `hasta ${priceMax.toLocaleString()} (moneda no especificada)`
    );
  }
  if (bedroomsResult) {
    parts.push(
      bedroomsResult.isMax
        ? `máx ${bedroomsResult.count} ${bedroomsResult.word}`
        : `${bedroomsResult.count} ${bedroomsResult.word}`
    );
  }
  if (bathroomsResult) {
    parts.push(
      bathroomsResult.isMax
        ? `máx ${bathroomsResult.count} baños`
        : `${bathroomsResult.count} baños`
    );
  }
  if (areaMin != null) parts.push(`desde ${areaMin} m² totales`);
  if (areaMax != null) parts.push(`hasta ${areaMax} m² totales`);
  if (areaCoveredMin != null) parts.push(`cubiertos desde ${areaCoveredMin} m²`);
  if (addressText) parts.push(`dirección similar a «${addressText}»`);
  if (titleContains) parts.push(`título con «${titleContains}»`);
  if (descriptionContains) parts.push(`descripción con «${descriptionContains}»`);
  if (keywords.length) parts.push(`palabras clave: ${keywords.join(', ')}`);
  if (source) parts.push(`origen ${source}`);
  if (amenities.length) parts.push(`con ${amenities.join(', ')}`);
  if (aptoCredito) parts.push('apto crédito');
  if (sortBy) {
    const sortLabels: Record<string, string> = {
      price_asc: 'más baratas primero',
      price_desc: 'más caras primero',
      area_desc: 'más grandes primero',
      date_desc: 'más recientes primero',
    };
    parts.push(sortLabels[sortBy] ?? sortBy);
  }
  if (photosCountMin != null) parts.push('con fotos');
  if (listingAgeDays != null) parts.push(`publicadas últimos ${listingAgeDays} días`);

  const explanation =
    parts.length > 0
      ? `Interpreté que buscás: ${parts.join(', ')}.`
      : 'No se detectó ningún criterio.';

  const warnings = hasRecognizedFilters(filters)
    ? []
    : [
        'No entendí criterios específicos. Probá con "departamento en Palermo" o "casa hasta 100k USD".',
      ];

  // Validación defensiva: si explanation sugiere datos pero filters está vacío => bug
  if (parts.length > 0 && !hasRecognizedFilters(filters) && process.env.NODE_ENV !== 'production') {
    throw new Error(
      `assistant_search_inconsistent: explanation tiene ${parts.length} partes pero filters vacío`
    );
  }

  return { filters, explanation, warnings };
}
