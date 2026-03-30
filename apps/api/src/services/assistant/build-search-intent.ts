import type { SearchFilters, SearchIntent } from '@matchprop/shared';

function strictFilterKeys(f: SearchFilters): string[] {
  const keys: string[] = [];
  if (f.operationType) keys.push('operationType');
  if (f.propertyType?.length) keys.push('propertyType');
  if (f.priceMin != null) keys.push('priceMin');
  if (f.priceMax != null) keys.push('priceMax');
  if (f.currency) keys.push('currency');
  if (f.bedroomsMin != null) keys.push('bedroomsMin');
  if (f.bedroomsMax != null) keys.push('bedroomsMax');
  if (f.bathroomsMin != null) keys.push('bathroomsMin');
  if (f.bathroomsMax != null) keys.push('bathroomsMax');
  if (f.areaMin != null) keys.push('areaMin');
  if (f.areaMax != null) keys.push('areaMax');
  if (f.areaCoveredMin != null) keys.push('areaCoveredMin');
  if (f.locationText?.trim()) keys.push('locationText');
  if (f.addressText?.trim()) keys.push('addressText');
  if (f.amenities?.length) keys.push('amenities');
  if (f.keywords?.length) keys.push('keywords');
  if (f.titleContains?.trim()) keys.push('titleContains');
  if (f.descriptionContains?.trim()) keys.push('descriptionContains');
  if (f.aptoCredito === true) keys.push('aptoCredito');
  if (f.source) keys.push('source');
  if (f.sortBy) keys.push('sortBy');
  if (f.photosCountMin != null) keys.push('photosCountMin');
  if (f.listingAgeDays != null) keys.push('listingAgeDays');
  if (f.minLat != null || f.maxLat != null || f.minLng != null || f.maxLng != null)
    keys.push('geoBounds');
  return keys;
}

function estimateConfidence(f: SearchFilters, usedLlm: boolean): number {
  let c = 0.55;
  if (f.operationType) c += 0.1;
  if (f.propertyType?.length) c += 0.08;
  if (f.locationText?.trim()) c += 0.1;
  if (f.priceMin != null || f.priceMax != null) c += 0.07;
  if (f.bedroomsMin != null || f.bedroomsMax != null) c += 0.05;
  if (f.amenities?.length) c += 0.05;
  if (usedLlm) c += 0.05;
  return Math.min(0.97, Math.round(c * 100) / 100);
}

export function buildSearchIntent(params: {
  filters: SearchFilters;
  rawQuery: string;
  softPreferences: string[];
  lifestyleSignals: string[];
  interpretationNotes: string[];
  usedLlm: boolean;
}): SearchIntent {
  const { filters, rawQuery, softPreferences, lifestyleSignals, interpretationNotes, usedLlm } =
    params;
  const lifestyle = lifestyleSignals.length ? lifestyleSignals : [...softPreferences];
  return {
    operation: filters.operationType,
    propertyTypes: filters.propertyType ? [...filters.propertyType] : undefined,
    locationRaw: filters.locationText ?? null,
    price: {
      min: filters.priceMin ?? null,
      max: filters.priceMax ?? null,
      currency: filters.currency ?? null,
    },
    features: {
      bedroomsMin: filters.bedroomsMin ?? null,
      bedroomsMax: filters.bedroomsMax ?? null,
      bathroomsMin: filters.bathroomsMin ?? null,
      bathroomsMax: filters.bathroomsMax ?? null,
    },
    amenities: filters.amenities ? [...filters.amenities] : undefined,
    strictFilters: strictFilterKeys(filters),
    softPreferences: softPreferences.length ? [...new Set(softPreferences)] : undefined,
    lifestyleSignals: lifestyle.length ? [...new Set(lifestyle)] : undefined,
    confidence: estimateConfidence(filters, usedLlm),
    rawQuery,
    interpretationNotes: interpretationNotes.length ? interpretationNotes : undefined,
    usedLlm,
  };
}
