import { describe, expect, it } from 'vitest';
import {
  SEARCH_FILTERS_MAX_ATOMS,
  capSearchFilters,
  countActiveFilterAtoms,
} from '../search-filter-cap.js';

describe('search-filter-cap', () => {
  it('countActiveFilterAtoms sums scalar fields, property types, amenities and keywords', () => {
    expect(
      countActiveFilterAtoms({
        operationType: 'SALE',
        propertyType: ['APARTMENT', 'HOUSE'],
        locationText: 'Palermo',
        priceMax: 100_000,
        keywords: ['luminoso', 'balcón'],
        amenities: ['POOL'],
      })
    ).toBe(8);
  });

  it('capSearchFilters leaves small payloads unchanged', () => {
    const f = { operationType: 'RENT' as const, locationText: 'Rosario', bedroomsMin: 2 };
    expect(capSearchFilters(f)).toEqual(f);
  });

  it('capSearchFilters trims to at most SEARCH_FILTERS_MAX_ATOMS', () => {
    const keywords = Array.from({ length: 25 }, (_, i) => `k${i}`);
    const f = {
      operationType: 'SALE' as const,
      locationText: 'CABA',
      priceMax: 200_000,
      keywords,
    };
    const out = capSearchFilters(f);
    expect(countActiveFilterAtoms(out)).toBeLessThanOrEqual(SEARCH_FILTERS_MAX_ATOMS);
    expect(out.operationType).toBe('SALE');
    expect(out.locationText).toBe('CABA');
    expect(out.priceMax).toBe(200_000);
    expect(out.keywords?.length).toBeLessThan(25);
  });
});
