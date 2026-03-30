import type { SearchFilters } from '@matchprop/shared';
import { AMENITY_SPECS, canonicalizeAmenityToken } from '../../lib/amenity-filter.js';
import { capSearchFilters, countActiveFilterAtoms } from './search-filter-cap.js';

const LOCATION_MAX = 200;
const TITLE_MAX = 100;
const DESC_MAX = 200;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;

/**
 * Sinónimos y abreviaturas → forma que matchean las regex del parser (depto, pileta, etc.).
 */
function normalizeSearchDialect(text: string): string {
  return (
    text
      .replace(/\bdepar(?=[\s,.]|$)/gi, 'depto')
      .replace(/\bdepars\b/gi, 'deptos')
      .replace(/\bdpto\b/gi, 'depto')
      .replace(/\bdptos\b/gi, 'deptos')
      .replace(/\bmonoambiente\b/gi, 'monoambiente')
      .replace(/\bpool\b/gi, 'piscina')
      .replace(/\bswimming\s*pool\b/gi, 'piscina')
  );
}

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
    /\bm[aá]s\s+barat[oa]s?|\bbarat[oa]s?\b|\beconom/i.test(lower) ||
    /ordenar\s+por\s+precio\s+asc|precio\s+asc|menor\s+precio/i.test(lower)
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

/** Corta barrios/localidades antes de precio u otros números (evita “en Funes hasta 150mil”). */
function cleanLocationFragment(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(
    /\s+(hasta|desde|m[aá]ximo|m[aá]x\.?|presupuesto|menos\s+de|por\s+)\s*[\d.,].*$/i,
    ''
  );
  s = s.replace(/\s+\d[\d.,]*\s*(k|mil|usd|u\$s|ars|pesos|d[oó]lares)\b.*$/i, '');
  return trunc(s);
}

function parseLocation(text: string): string {
  const patterns = [
    /(?:por|en)\s+(?:el\s+)?(centro|macrocentro|microcentro|zona\s+norte|zona\s+sur)\b/i,
    /\b(?:busco|buscamos|quiero|necesito|ver|alquilar|comprar|propiedad|vivienda)\b[^,.]{0,50}?\s+en\s+([A-Za-záéíóúÁÉÍÓÚñÑ][A-Za-záéíóúÁÉÍÓÚñÑ\s]{1,48}?)(?=\s*[,.;]|$|\s+(?:con|hasta|desde|que|y|o|para)\s|\s+\d)/i,
    /en\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s+(?:casa|depto|departamento|terreno|local|oficina)|,|\.|$)/i,
    /en\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?=\s*[,.]|$|\s+\d|\s+hasta|\s+desde|\s+m[aá]x)/i,
    /\ben\s+([A-Za-záéíóúÁÉÍÓÚñÑ]{4,}(?:\s+[A-Za-záéíóúÁÉÍÓÚñÑ]+){0,2})\s*$/i,
    /(zona\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|,|\.|$)/i,
    /(?:en\s+)?(Palermo|Nordelta|Microcentro|Rosario|CABA|Belgrano|Caballito|Villa\s+Crespo|Funes|Fisherton|Roldán|Córdoba|Mendoza|Pilar|Tigre|San\s+Isidro|Vicente\s+López|Santa\s+Fe|La\s+Plata|Mar\s+del\s+Plata|Salta|Tucumán|Neuquén|Bariloche)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const loc = cleanLocationFragment(m[1]);
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
  const rentish = /alquiler|rent|arriendo|alquilar|temporal/i.test(lower);
  const saleish =
    /comprar|venta|vender|for\s*sale|\bbuy\b|invertir|inversi[oó]n|compra\b/i.test(lower) ||
    /\bmi\s+casa\b|\bcasa\s+propia\b|\bser\s+propietario\b|\bpropietarios?\b/i.test(lower) ||
    (!rentish && /\bmudarme\b|\bmudanza\b/.test(lower));
  if (saleish && !rentish) return 'SALE';
  if (rentish) return 'RENT';
  return undefined;
}

/** Señales blandas detectadas por reglas (no siempre se traducen a WHERE). */
export function extractSoftPreferences(text: string): string[] {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  if (/\bfamilia|hijos|niñ[oa]s?|chicos\b/.test(lower)) out.add('familia');
  if (/\bluminos/.test(lower)) out.add('luminoso');
  if (/\bmodern[oa]s?\b/.test(lower)) out.add('moderno');
  if (/\btranquil[oa]s?\b/.test(lower)) out.add('tranquilo');
  if (/\bverde\b|vegetaci|arbol/.test(lower)) out.add('verde');
  if (/\bchic[oa]s?\b|\bpequeñ[oa]s?\b|\bcompact[oa]s?\b/.test(lower)) out.add('compacto');
  if (/\bpremium\b|\balta\s+gama\b|\blujos[oa]s?\b/.test(lower)) out.add('premium');
  if (/\bcerca\s+de\s+todo\b|ubicaci[oó]n\s+central/.test(lower)) out.add('ubicación céntrica');
  if (/\bmudarme\s+ya\b|\burgente\b|\brapido\b|\brápido\b/.test(lower)) out.add('urgente');
  return [...out];
}

function parseCurrency(text: string): string | undefined {
  if (/\busd\b|dólar|dolar/i.test(text)) return 'USD';
  if (/\bars\b|peso|argentino/i.test(text)) return 'ARS';
  return undefined;
}

/** "depto o casa", "casa o ph", etc.: el usuario quiere OR explícito en el feed. */
function hasExplicitPropertyTypeOr(lower: string): boolean {
  return /\b(departamentos?|deptos?|depto|casa|casas|ph\b|terrenos?|lotes?|chalets?|local(?:es)?\s+comercial|oficinas?)\s+o\s+(departamentos?|deptos?|depto|casa|casas|ph\b|terrenos?|lotes?|chalets?|local|locales|oficinas?)\b/i.test(
    lower
  );
}

function firstMatchIndex(s: string, re: RegExp): number {
  const m = re.exec(s);
  return m?.index != null ? m.index : Number.POSITIVE_INFINITY;
}

const TYPE_PRIORITY: (typeof VALID_PROPERTY_TYPES)[number][] = [
  'LAND',
  'OFFICE',
  'OTHER',
  'HOUSE',
  'APARTMENT',
];

/**
 * Tipos de propiedad con límites de palabra y menos falsos positivos:
 * - "con oficina" / "con local" en una casa no cuentan como OFFICE.
 * - "localidad" no dispara OFFICE (\blocal\b no matchea dentro de localidad).
 * - "loteo" no cuenta como LAND.
 * - OFFICE: local comercial, oficina explícita, consultorio, planta libre, o "busco local".
 * - Si el texto sugiere varios tipos sin un "o" explícito, se elige uno (primer match) para
 *   no mezclar resultados en el feed (Prisma usa `in` = OR).
 */
function parsePropertyType(text: string): string[] | undefined {
  const stripped = text
    .replace(/\bcon\s+oficinas?\b/gi, ' ')
    .replace(/\bcon\s+un\s+oficinas?\b/gi, ' ')
    .replace(/\bcon\s+locales?\s+chicos?\b/gi, ' ')
    .replace(/\bcon\s+local\b/gi, ' ');
  const lower = stripped.toLowerCase();
  const found: string[] = [];

  const hasHouse =
    /\b(casas?|chalets?|chalet|viviendas?\s+unifamiliares?|vivienda\s+unifamiliar|houses?)\b/i.test(
      lower
    );
  const hasApt =
    /\b(departamentos?|deptos?|\bdepto\b|depar\b|apartments?|\bph\b|p\.h\.|monoambientes?|mono\s*ambientes?|semipisos?|lofts?|duplex\b)\b/i.test(
      lower
    ) || /\bpiso\s+(alto|bajo|\d+)\b/i.test(lower);
  const hasLand =
    /\b(terrenos?|lotes?|lands?)\b/i.test(lower) &&
    !/\b(loteo|lotificaci[oó]n|loteamiento)\b/i.test(lower);
  const hasOffice =
    /\b(local(?:es)?\s+comercial(?:es)?|planta\s+libre|consultorios?|offices?)\b/i.test(lower) ||
    /\boficinas?\s+(en\s+)?(venta|alquiler|alquiler\s+temporal)\b/i.test(lower) ||
    /\b(locales?)\s+(en\s+)?(venta|alquiler)\b/i.test(lower) ||
    /\b(venta|alquiler)\s+(de\s+)?(un\s+)?(local|locales|oficina|oficinas)\b/i.test(lower) ||
    /\b(busco|buscamos|quiero|necesito|solo|únicamente|unicamente)\s+(un\s+)?(local|oficina|locales|oficinas)\b/i.test(
      lower
    ) ||
    (/\b(local|locales)\b/i.test(lower) && /\b(comercial|showroom|galería|galeria)\b/i.test(lower));

  const dwellingMention =
    /\b(departamentos?|deptos?|\bdepto\b|depar\b|monoambientes?|mono\s*ambientes?|semipisos?|lofts?|casas?|ph\b|terrenos?|lotes?|locales?\s+comercial|oficinas?|duplex\b)\b/i.test(
      lower
    ) || /\bpiso\s+(alto|bajo|\d+)\b/i.test(lower);

  const hasParkingListing =
    /\bcocheras?\b/i.test(lower) &&
    /\b(venta|alquiler|en\s+venta|en\s+alquiler)\b/i.test(lower) &&
    !dwellingMention;

  const hasIndustrial =
    /\b(galp[oó]n|galpones)\b/i.test(lower) &&
    !/\b(casa|departamento|deptos?|\bdepto\b|ph\b)\b/i.test(lower);

  if (hasHouse) found.push('HOUSE');
  if (hasApt) found.push('APARTMENT');
  if (hasLand) found.push('LAND');
  if (hasOffice) found.push('OFFICE');
  if (hasParkingListing || hasIndustrial) found.push('OTHER');

  let unique = [...new Set(found)].filter((t) =>
    VALID_PROPERTY_TYPES.includes(t as (typeof VALID_PROPERTY_TYPES)[number])
  ) as string[];

  if (unique.length > 1 && !hasExplicitPropertyTypeOr(lower)) {
    const reByType: Record<string, RegExp> = {
      LAND: /\b(terrenos?|lotes?|lands?)\b/i,
      OFFICE:
        /\b(local(?:es)?\s+comercial(?:es)?|planta\s+libre|consultorios?|offices?|oficinas?)\b/i,
      OTHER: /\b(cocheras?|galp[oó]n|galpones)\b/i,
      HOUSE:
        /\b(casas?|chalets?|chalet|viviendas?\s+unifamiliares?|vivienda\s+unifamiliar|houses?)\b/i,
      APARTMENT:
        /\b(departamentos?|deptos?|\bdepto\b|depar\b|apartments?|\bph\b|p\.h\.|monoambientes?|mono\s*ambientes?|semipisos?|lofts?|duplex\b|piso\s+(alto|bajo|\d+))\b/i,
    };
    let best: { t: string; idx: number } | null = null;
    for (const t of unique) {
      const re = reByType[t];
      if (!re) continue;
      const idx = firstMatchIndex(lower, re);
      if (!best || idx < best.idx) best = { t, idx };
      else if (best && idx === best.idx) {
        const pa = TYPE_PRIORITY.indexOf(t as (typeof VALID_PROPERTY_TYPES)[number]);
        const pb = TYPE_PRIORITY.indexOf(best.t as (typeof VALID_PROPERTY_TYPES)[number]);
        if (pa >= 0 && pb >= 0 && pa < pb) best = { t, idx };
      }
    }
    if (best && best.idx < Number.POSITIVE_INFINITY) {
      unique = [best.t];
    } else {
      const pick =
        TYPE_PRIORITY.find((t) => unique.includes(t)) ??
        (unique[0] as (typeof VALID_PROPERTY_TYPES)[number]);
      unique = [pick];
    }
  }

  return unique.length ? unique : undefined;
}

/** Amenidades: misma fuente que el formulario / feed (`AMENITY_SPECS`) para objetividad. */
function phraseMatchesAmenityPhrase(text: string, phrase: string): boolean {
  const t = text.toLowerCase();
  const p = phrase.toLowerCase().trim();
  if (p.length < 2) return false;
  if (/\s/.test(p)) return t.includes(p);
  try {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`, 'i').test(text);
  } catch {
    return t.includes(p);
  }
}

function parseAmenities(text: string): string[] {
  const found = new Set<string>();
  for (const [canonical, spec] of Object.entries(AMENITY_SPECS)) {
    for (const phrase of spec.contains) {
      if (phraseMatchesAmenityPhrase(text, phrase)) {
        found.add(canonicalizeAmenityToken(canonical));
        break;
      }
    }
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
  softPreferences: string[];
} {
  const t = normalizeSearchDialect(text.trim());
  if (!t) {
    return {
      filters: {},
      explanation: 'No se detectó ningún criterio.',
      warnings: [
        'No entendí criterios específicos. Probá con "departamento en Palermo" o "casa hasta 100k USD".',
      ],
      softPreferences: [],
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
  const softPreferences = extractSoftPreferences(t);
  const aptoCredito = parseAptoCredito(t);
  const sortBy = parseSortBy(t);
  const photosCountMin = parsePhotosCountMin(t);
  const listingAgeDays = parseListingAgeDays(t);

  const filtersRaw: SearchFilters = {};
  if (operation) filtersRaw.operationType = operation;
  if (currency) filtersRaw.currency = currency;
  if (priceMin != null) filtersRaw.priceMin = priceMin;
  if (priceMax != null) filtersRaw.priceMax = priceMax;
  if (bedroomsResult != null) {
    if (bedroomsResult.isMax) filtersRaw.bedroomsMax = bedroomsResult.count;
    else filtersRaw.bedroomsMin = bedroomsResult.count;
  }
  if (bathroomsResult != null) {
    if (bathroomsResult.isMax) filtersRaw.bathroomsMax = bathroomsResult.count;
    else filtersRaw.bathroomsMin = bathroomsResult.count;
  }
  if (areaMin != null) filtersRaw.areaMin = areaMin;
  if (areaMax != null) filtersRaw.areaMax = areaMax;
  if (areaCoveredMin != null) filtersRaw.areaCoveredMin = areaCoveredMin;
  if (locationText) filtersRaw.locationText = locationText;
  if (addressText) filtersRaw.addressText = addressText;
  if (titleContains) filtersRaw.titleContains = titleContains;
  if (descriptionContains) filtersRaw.descriptionContains = descriptionContains;
  if (keywords.length) filtersRaw.keywords = keywords;
  if (source) filtersRaw.source = source;
  if (propertyType?.length) filtersRaw.propertyType = propertyType;
  if (amenities.length) filtersRaw.amenities = amenities;
  if (aptoCredito === true) filtersRaw.aptoCredito = aptoCredito;
  if (sortBy) filtersRaw.sortBy = sortBy;
  if (photosCountMin != null) filtersRaw.photosCountMin = photosCountMin;
  if (listingAgeDays != null) filtersRaw.listingAgeDays = listingAgeDays;

  /** Listados: por defecto siempre más recientes primero salvo que el texto pida otro orden. */
  if (hasRecognizedFilters(filtersRaw) && filtersRaw.sortBy == null) {
    filtersRaw.sortBy = 'date_desc';
  }

  const atomsBeforeCap = countActiveFilterAtoms(filtersRaw);
  const filters = capSearchFilters(filtersRaw);
  const capTrimmed = countActiveFilterAtoms(filters) < atomsBeforeCap;

  const parts: string[] = [];
  if (filters.operationType) parts.push(filters.operationType === 'SALE' ? 'venta' : 'alquiler');
  if (filters.propertyType?.length) {
    parts.push(filters.propertyType.map((p) => p.toLowerCase()).join(' o '));
  }
  if (filters.locationText) parts.push(`en ${filters.locationText}`);
  if (filters.priceMin != null) {
    parts.push(
      `desde ${filters.priceMin.toLocaleString()}${filters.currency ? ` ${filters.currency}` : ''}`
    );
  }
  if (filters.priceMax != null) {
    parts.push(
      filters.currency
        ? `hasta ${filters.priceMax.toLocaleString()} ${filters.currency}`
        : `hasta ${filters.priceMax.toLocaleString()} (moneda no especificada)`
    );
  }
  if (filters.bedroomsMin != null) {
    const matchLocal =
      bedroomsResult && !bedroomsResult.isMax && bedroomsResult.count === filters.bedroomsMin;
    parts.push(
      matchLocal
        ? `${bedroomsResult.count} ${bedroomsResult.word}`
        : `al menos ${filters.bedroomsMin} dormitorios`
    );
  }
  if (filters.bedroomsMax != null) {
    const matchLocal =
      bedroomsResult && bedroomsResult.isMax && bedroomsResult.count === filters.bedroomsMax;
    parts.push(
      matchLocal
        ? `máx ${bedroomsResult.count} ${bedroomsResult.word}`
        : `máx ${filters.bedroomsMax} dormitorios`
    );
  }
  if (filters.bathroomsMin != null) {
    parts.push(`${filters.bathroomsMin} baños`);
  }
  if (filters.bathroomsMax != null) {
    parts.push(`máx ${filters.bathroomsMax} baños`);
  }
  if (filters.areaMin != null) parts.push(`desde ${filters.areaMin} m² totales`);
  if (filters.areaMax != null) parts.push(`hasta ${filters.areaMax} m² totales`);
  if (filters.areaCoveredMin != null) parts.push(`cubiertos desde ${filters.areaCoveredMin} m²`);
  if (filters.addressText) parts.push(`dirección similar a «${filters.addressText}»`);
  if (filters.titleContains) parts.push(`título con «${filters.titleContains}»`);
  if (filters.descriptionContains) parts.push(`descripción con «${filters.descriptionContains}»`);
  if (filters.keywords?.length) parts.push(`palabras clave: ${filters.keywords.join(', ')}`);
  if (filters.source) parts.push(`origen ${filters.source}`);
  if (filters.amenities?.length) parts.push(`con ${filters.amenities.join(', ')}`);
  if (filters.aptoCredito) parts.push('apto crédito');
  if (filters.sortBy) {
    const sortLabels: Record<string, string> = {
      price_asc: 'más baratas primero',
      price_desc: 'más caras primero',
      area_desc: 'más grandes primero',
      date_desc: 'más recientes primero',
    };
    parts.push(sortLabels[filters.sortBy] ?? filters.sortBy);
  }
  if (filters.photosCountMin != null) parts.push('con fotos');
  if (filters.listingAgeDays != null) {
    parts.push(`publicadas últimos ${filters.listingAgeDays} días`);
  }

  const explanation =
    parts.length > 0
      ? `Interpreté que buscás: ${parts.join(', ')}.`
      : 'No se detectó ningún criterio.';

  const warnings = hasRecognizedFilters(filters)
    ? []
    : [
        'No entendí criterios específicos. Probá con "departamento en Palermo" o "casa hasta 100k USD".',
      ];
  if (capTrimmed && hasRecognizedFilters(filters)) {
    warnings.push(
      'Se aplicó un máximo de 20 criterios activos; se priorizó operación, tipo, ubicación y precio frente a extras.'
    );
  }

  // Validación defensiva: si explanation sugiere datos pero filters está vacío => bug
  if (parts.length > 0 && !hasRecognizedFilters(filters) && process.env.NODE_ENV !== 'production') {
    throw new Error(
      `assistant_search_inconsistent: explanation tiene ${parts.length} partes pero filters vacío`
    );
  }

  return { filters, explanation, warnings, softPreferences };
}
