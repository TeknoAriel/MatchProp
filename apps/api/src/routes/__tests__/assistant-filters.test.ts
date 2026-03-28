import { describe, it, expect } from 'vitest';
import { relaxFilters, broadSearchFilters } from '../assistant.js';

describe('assistant filter fallbacks', () => {
  it('relaxFilters conserva tipo de propiedad y zona', () => {
    const f = relaxFilters({
      operationType: 'SALE',
      propertyType: ['APARTMENT'],
      locationText: 'Palermo',
      bedroomsMin: 3,
      priceMax: 150000,
      areaMin: 80,
    });
    expect(f.propertyType).toEqual(['APARTMENT']);
    expect(f.locationText).toBe('Palermo');
    expect(f.areaMin).toBeUndefined();
    expect(f.bedroomsMin).toBe(2);
  });

  it('broadSearchFilters mantiene tipo y zona sin precio', () => {
    const f = broadSearchFilters({
      operationType: 'RENT',
      propertyType: ['APARTMENT'],
      locationText: 'Rosario',
      priceMax: 500000,
      bedroomsMin: 2,
    });
    expect(f.propertyType).toEqual(['APARTMENT']);
    expect(f.locationText).toBe('Rosario');
    expect(f.priceMax).toBeUndefined();
    expect(f.bedroomsMin).toBeUndefined();
  });
});
