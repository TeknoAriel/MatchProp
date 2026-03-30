import { describe, it, expect } from 'vitest';
import { applyRefinementCommands, mergeCarriedAndParsed } from '../search-refinement.js';
import type { SearchFilters } from '@matchprop/shared';

describe('applyRefinementCommands', () => {
  it('"más barato" baja techo y ordena por precio', () => {
    const prev: SearchFilters = {
      operationType: 'SALE',
      propertyType: ['HOUSE'],
      priceMax: 100_000,
    };
    const r = applyRefinementCommands('mostrame algo más barato', prev);
    expect(r.sortBy).toBe('price_asc');
    expect(r.priceMax).toBeLessThan(100_000);
    expect(r.operationType).toBe('SALE');
  });

  it('"prefiero departamento y no casa" fuerza APARTMENT', () => {
    const prev: SearchFilters = { propertyType: ['HOUSE'], operationType: 'SALE' };
    const r = applyRefinementCommands('prefiero departamento y no casa', prev);
    expect(r.propertyType).toEqual(['APARTMENT']);
  });

  it('"solo con cochera" agrega amenity', () => {
    const prev: SearchFilters = { operationType: 'RENT' };
    const r = applyRefinementCommands('necesito solo con cochera', prev);
    expect(r.amenities?.map((a) => a.toLowerCase())).toContain('cochera');
  });
});

describe('mergeCarriedAndParsed', () => {
  it('el parse nuevo pisa campos definidos', () => {
    const carried: SearchFilters = { operationType: 'SALE', priceMax: 90_000 };
    const parsed: SearchFilters = { locationText: 'Centro', bedroomsMin: 2 };
    const m = mergeCarriedAndParsed(carried, parsed);
    expect(m.operationType).toBe('SALE');
    expect(m.priceMax).toBe(90_000);
    expect(m.locationText).toContain('Centro');
    expect(m.bedroomsMin).toBe(2);
  });
});
