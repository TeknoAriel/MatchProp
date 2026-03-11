import type { SearchFilters } from '@matchprop/shared';

const LOCATION_MAX = 200;
const VALID_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;

function trunc(s: string): string {
  return s.trim().slice(0, LOCATION_MAX) || '';
}

/** Gatillos de precio: solo asignar price si el texto contiene alguno. */
const PRICE_TRIGGERS =
  /hasta|máx|max|presupuesto|por\s+\d|menos\s+de|\busd\b|u\$s|\bars\b|\$|pesos|dólares|dolares/i;

function parsePrice(text: string): number | undefined {
  if (!PRICE_TRIGGERS.test(text)) return undefined;

  const lower = text.toLowerCase();
  // 100.000 o 100,000 = 100 mil (separador de miles, con contexto de precio)
  const thousandsMatch = text.match(/(\d{1,3})[.,](\d{3})(?:\s|$|k|mil|usd|ars)/i);
  if (thousandsMatch) {
    const n = parseInt(thousandsMatch[1]! + thousandsMatch[2]!, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  // Gatillo explícito: hasta/max/presupuesto/por/menos de + número
  const triggerMatch = lower.match(
    /(?:hasta|máx|max|presupuesto|por|menos\s+de)\s*(\d+(?:[.,]\d+)?)\s*(k|mil|000)?/i
  );
  if (triggerMatch) {
    let n = parseFloat(triggerMatch[1]!.replace(',', '.'));
    const suffix = triggerMatch[2]?.toLowerCase();
    if (suffix === 'k' || suffix === '000') n *= 1000;
    else if (suffix === 'mil') n *= 1000;
    return Math.round(n);
  }
  // Número + moneda: "120k usd", "900k ars", "60 mil" (con presupuesto/hasta en texto)
  const numCurrencyMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(k|mil|000)?\s*(usd|u\$s|ars|pesos|dólares|dolares)/i
  );
  if (numCurrencyMatch) {
    let n = parseFloat(numCurrencyMatch[1]!.replace(',', '.'));
    const suffix = numCurrencyMatch[2]?.toLowerCase();
    if (suffix === 'k' || suffix === '000') n *= 1000;
    else if (suffix === 'mil') n *= 1000;
    return Math.round(n);
  }
  // $ número: "$ 120000" o "$120000"
  const dollarMatch = text.match(/\$\s*(\d[\d.,]*)/);
  if (dollarMatch) {
    const n = parseFloat(dollarMatch[1]!.replace(/[.,]/g, (c) => (c === ',' ? '' : '.')));
    return Number.isNaN(n) ? undefined : Math.round(n);
  }
  return undefined;
}

function parseBedrooms(
  text: string
): { count: number; word: 'dormitorios' | 'ambientes' } | undefined {
  const dormMatch = text.match(
    /(\d+)\s*(?:dorms?|dormitorios?|dormis|habitaci[oó]ns?|habitaciones)/i
  );
  if (dormMatch) return { count: parseInt(dormMatch[1]!, 10), word: 'dormitorios' };
  const ambMatch = text.match(/(\d+)\s*(?:amb|ambientes)/i);
  if (ambMatch) return { count: parseInt(ambMatch[1]!, 10), word: 'ambientes' };
  return undefined;
}

function parseBathrooms(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:baño|baños|bath)/i);
  return m ? parseInt(m[1]!, 10) : undefined;
}

function parseLocation(text: string): string {
  const patterns = [
    /en\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|,|\.|$)/i,
    /(zona\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|,|\.|$)/i, // "zona norte" completo
    /(?:en\s+)?(Palermo|Nordelta|Microcentro|Rosario|CABA|Belgrano|Caballito|Villa\s+Crespo)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return trunc(m[1]);
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

function parseAreaMin(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:m2|mts2|m²|m\s*2|metros?\s*cuadrados?)/i);
  return m ? parseInt(m[1]!, 10) : undefined;
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

function hasRecognizedFilters(f: SearchFilters): boolean {
  return (
    f.operationType != null ||
    (f.propertyType?.length ?? 0) > 0 ||
    f.priceMin != null ||
    f.priceMax != null ||
    f.bedroomsMin != null ||
    f.bathroomsMin != null ||
    f.areaMin != null ||
    (f.locationText?.trim()?.length ?? 0) > 0 ||
    f.currency != null ||
    (f.keywords?.length ?? 0) > 0
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
  const priceMax = parsePrice(t);
  const bedroomsResult = parseBedrooms(t);
  const bathrooms = parseBathrooms(t);
  const areaMin = parseAreaMin(t);
  const locationText = parseLocation(t);
  const propertyType = parsePropertyType(t);

  const filters: SearchFilters = {};
  if (operation) filters.operationType = operation;
  if (currency) filters.currency = currency;
  if (priceMax != null) filters.priceMax = priceMax;
  if (bedroomsResult != null) filters.bedroomsMin = bedroomsResult.count;
  if (bathrooms != null) filters.bathroomsMin = bathrooms;
  if (areaMin != null) filters.areaMin = areaMin;
  if (locationText) filters.locationText = locationText;
  if (propertyType?.length) filters.propertyType = propertyType;

  const parts: string[] = [];
  if (operation) parts.push(operation === 'SALE' ? 'venta' : 'alquiler');
  if (propertyType?.length) parts.push(propertyType.map((p) => p.toLowerCase()).join(' o '));
  if (locationText) parts.push(`en ${locationText}`);
  if (priceMax) {
    if (currency) {
      parts.push(`hasta ${priceMax.toLocaleString()} ${currency}`);
    } else {
      parts.push(`hasta ${priceMax.toLocaleString()} (moneda no especificada)`);
    }
  }
  if (bedroomsResult) parts.push(`${bedroomsResult.count} ${bedroomsResult.word}`);
  if (bathrooms) parts.push(`${bathrooms} baños`);
  if (areaMin) parts.push(`${areaMin} m²`);

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
