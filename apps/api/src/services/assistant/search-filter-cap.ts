import type { SearchFilters } from '@matchprop/shared';

/** Máximo de “átomos” de filtro por búsqueda texto/voz (alineado a producto beta). */
export const SEARCH_FILTERS_MAX_ATOMS = 20;

/**
 * Cuenta criterios activos: cada tipo en propertyType, cada amenity y keyword cuenta 1;
 * campos escalares 1 c/u; bounds mapa 1 c/u.
 */
export function countActiveFilterAtoms(f: SearchFilters): number {
  let n = 0;
  if (f.operationType) n++;
  n += f.propertyType?.length ?? 0;
  if (f.locationText?.trim()) n++;
  if (f.addressText?.trim()) n++;
  if (f.priceMin != null) n++;
  if (f.priceMax != null) n++;
  if (f.currency) n++;
  if (f.bedroomsMin != null) n++;
  if (f.bedroomsMax != null) n++;
  if (f.bathroomsMin != null) n++;
  if (f.bathroomsMax != null) n++;
  if (f.areaMin != null) n++;
  if (f.areaMax != null) n++;
  if (f.areaCoveredMin != null) n++;
  if (f.titleContains?.trim()) n++;
  if (f.descriptionContains?.trim()) n++;
  if (f.aptoCredito === true) n++;
  if (f.source) n++;
  if (f.sortBy) n++;
  if (f.photosCountMin != null) n++;
  if (f.listingAgeDays != null) n++;
  n += f.amenities?.length ?? 0;
  n += f.keywords?.length ?? 0;
  if (f.minLat != null) n++;
  if (f.maxLat != null) n++;
  if (f.minLng != null) n++;
  if (f.maxLng != null) n++;
  return n;
}

function cloneFilters(f: SearchFilters): SearchFilters {
  return {
    ...f,
    propertyType: f.propertyType?.length ? [...f.propertyType] : undefined,
    amenities: f.amenities?.length ? [...f.amenities] : undefined,
    keywords: f.keywords?.length ? [...f.keywords] : undefined,
  };
}

/**
 * Recorta filtros menos críticos primero hasta ≤ maxAtoms.
 * Prioridad: operación, tipo, ubicación, precio, ambientes, superficie; luego texto/amenities/keywords/map.
 */
export function capSearchFilters(
  f: SearchFilters,
  maxAtoms: number = SEARCH_FILTERS_MAX_ATOMS
): SearchFilters {
  if (countActiveFilterAtoms(f) <= maxAtoms) return f;
  const out = cloneFilters(f);

  const trimOne = (): boolean => {
    if (out.maxLng != null) {
      delete out.maxLng;
      return true;
    }
    if (out.minLng != null) {
      delete out.minLng;
      return true;
    }
    if (out.maxLat != null) {
      delete out.maxLat;
      return true;
    }
    if (out.minLat != null) {
      delete out.minLat;
      return true;
    }
    if (out.keywords?.length) {
      out.keywords = out.keywords.slice(0, -1);
      if (!out.keywords.length) delete out.keywords;
      return true;
    }
    if (out.amenities?.length) {
      out.amenities = out.amenities.slice(0, -1);
      if (!out.amenities.length) delete out.amenities;
      return true;
    }
    if (out.listingAgeDays != null) {
      delete out.listingAgeDays;
      return true;
    }
    if (out.photosCountMin != null) {
      delete out.photosCountMin;
      return true;
    }
    if (out.sortBy) {
      delete out.sortBy;
      return true;
    }
    if (out.source) {
      delete out.source;
      return true;
    }
    if (out.aptoCredito === true) {
      delete out.aptoCredito;
      return true;
    }
    if (out.titleContains?.trim()) {
      delete out.titleContains;
      return true;
    }
    if (out.descriptionContains?.trim()) {
      delete out.descriptionContains;
      return true;
    }
    if (out.areaCoveredMin != null) {
      delete out.areaCoveredMin;
      return true;
    }
    if (out.areaMax != null) {
      delete out.areaMax;
      return true;
    }
    if (out.areaMin != null) {
      delete out.areaMin;
      return true;
    }
    if (out.bathroomsMax != null) {
      delete out.bathroomsMax;
      return true;
    }
    if (out.bathroomsMin != null) {
      delete out.bathroomsMin;
      return true;
    }
    if (out.bedroomsMax != null) {
      delete out.bedroomsMax;
      return true;
    }
    if (out.bedroomsMin != null) {
      delete out.bedroomsMin;
      return true;
    }
    if (out.currency) {
      delete out.currency;
      return true;
    }
    if (out.priceMax != null) {
      delete out.priceMax;
      return true;
    }
    if (out.priceMin != null) {
      delete out.priceMin;
      return true;
    }
    if (out.propertyType && out.propertyType.length > 1) {
      out.propertyType = out.propertyType.slice(0, 1);
      return true;
    }
    if (out.addressText?.trim()) {
      delete out.addressText;
      return true;
    }
    if (out.locationText?.trim()) {
      delete out.locationText;
      return true;
    }
    if (out.propertyType?.length) {
      delete out.propertyType;
      return true;
    }
    if (out.operationType) {
      delete out.operationType;
      return true;
    }
    return false;
  };

  let guard = 0;
  while (countActiveFilterAtoms(out) > maxAtoms && guard++ < 64) {
    if (!trimOne()) break;
  }
  return out;
}
