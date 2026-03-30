import type { SearchFilters } from '@matchprop/shared';
import { canonicalizeAmenityToken } from '../../lib/amenity-filter.js';

function uniqAmenities(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const c = canonicalizeAmenityToken(x);
    const k = c.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * A partir de la búsqueda anterior + mensaje corto de refinamiento, ajusta filtros
 * (sin re-parsear todo el mundo; el merge con el parse del nuevo texto lo hace el intérprete).
 */
export function applyRefinementCommands(
  newText: string,
  previous: SearchFilters | undefined
): SearchFilters {
  if (!previous || Object.keys(previous).length === 0) return {};
  const t = newText.trim();
  const lower = t.toLowerCase();
  const next: SearchFilters = { ...previous };

  const similarCheaper =
    /\bparecid[oa]\b.*\b(m[aá]s\s+)?barat|\balgo\s+parecid/i.test(lower) &&
    /\bbarat|m[aá]s\s+barat|menos\s+car/i.test(lower);

  if (
    /\bm[aá]s\s+barat|\bbeconom|\bbarato\b|\bmenos\s+car[oa]\b|\bm[aá]s\s+econom/i.test(lower) ||
    similarCheaper
  ) {
    next.sortBy = 'price_asc';
    if (typeof next.priceMax === 'number' && next.priceMax > 10_000) {
      next.priceMax = Math.round(next.priceMax * 0.88);
    }
  }

  if (/\bpremium\b|\balta\s+gama\b|\bm[aá]s\s+car[oa]\b|\blujos/i.test(lower)) {
    next.sortBy = 'price_desc';
    if (typeof next.priceMin === 'number' && next.priceMin > 0) {
      next.priceMin = Math.round(next.priceMin * 1.08);
    }
  }

  if (
    /\b(solo|únicamente|unicamente|prefiero)\s+(un\s+)?(depto|departamento)/i.test(lower) ||
    /\bno\s+(quiero\s+)?casa\b|\bprefiero\s+depto\b/i.test(lower)
  ) {
    next.propertyType = ['APARTMENT'];
  }

  if (
    /\b(solo|únicamente|unicamente)\s+(una\s+)?casa\b|\bno\s+(quiero\s+)?(depto|departamento)/i.test(
      lower
    )
  ) {
    next.propertyType = ['HOUSE'];
  }

  if (
    /\balquiler\b|\balquilar\b|\brentar\b/i.test(lower) &&
    !/comprar|venta\s+(?!con)/i.test(lower)
  ) {
    next.operationType = 'RENT';
  }

  if (
    /\bcomprar\b|\ben\s+venta\b|\bcompra\b/i.test(lower) &&
    !/\balquiler\b|\balquilar\b/i.test(lower)
  ) {
    next.operationType = 'SALE';
  }

  if (/\bcochera\b|\bgarage\b|\bestacionamiento\b/i.test(lower)) {
    const base = next.amenities ?? [];
    next.amenities = uniqAmenities([...base, 'cochera']);
  }

  if (/\bpileta\b|\bpiscina\b/i.test(lower)) {
    const base = next.amenities ?? [];
    next.amenities = uniqAmenities([...base, 'pileta']);
  }

  if (/\bjard[ií]n\b|\bpatio\b/i.test(lower)) {
    const base = next.amenities ?? [];
    next.amenities = uniqAmenities([...base, 'jardín']);
  }

  if (/\bparrill/i.test(lower)) {
    const base = next.amenities ?? [];
    next.amenities = uniqAmenities([...base, 'parrilla']);
  }

  if (/\bbalc[oó]n\b/i.test(lower)) {
    const base = next.amenities ?? [];
    next.amenities = uniqAmenities([...base, 'balcón']);
  }

  return next;
}

export function mergeCarriedAndParsed(
  carried: SearchFilters,
  parsed: SearchFilters
): SearchFilters {
  const out: SearchFilters = { ...carried };
  for (const [key, v] of Object.entries(parsed)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (key === 'amenities' && Array.isArray(v)) {
      out.amenities = uniqAmenities([...(out.amenities ?? []), ...v]);
    } else {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
