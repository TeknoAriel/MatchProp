import { describe, it, expect } from 'vitest';
import { createFeedTotalCache, normalizeFiltersForCache } from '../feed-total-cache.js';

describe('normalizeFiltersForCache', () => {
  it('arrays en distinto orden producen misma key', () => {
    const a = normalizeFiltersForCache({ propertyTypes: ['HOUSE', 'APARTMENT'] });
    const b = normalizeFiltersForCache({ propertyTypes: ['APARTMENT', 'HOUSE'] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('locationText vacío y null equivalen', () => {
    const a = normalizeFiltersForCache({ locationText: '' });
    const b = normalizeFiltersForCache({ locationText: null });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('createFeedTotalCache', () => {
  describe('hit/miss', () => {
    it('get sin set devuelve null', () => {
      const { getCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      expect(getCachedTotal('u1', {})).toBeNull();
    });

    it('set luego get devuelve el valor', () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      setCachedTotal('u1', { operation: 'SALE' }, 42);
      expect(getCachedTotal('u1', { operation: 'SALE' })).toBe(42);
    });
  });

  describe('normalización en cache key', () => {
    it('propertyTypes en distinto orden comparten cache', () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      setCachedTotal('u1', { propertyTypes: ['HOUSE', 'APARTMENT'] }, 10);
      expect(getCachedTotal('u1', { propertyTypes: ['APARTMENT', 'HOUSE'] })).toBe(10);
    });
  });

  describe('LRU eviction', () => {
    it('con maxEntries=3 evicta el menos reciente, no el recién accedido', () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 3 });
      setCachedTotal('u1', { a: 1 }, 1);
      setCachedTotal('u1', { a: 2 }, 2);
      setCachedTotal('u1', { a: 3 }, 3);
      getCachedTotal('u1', { a: 1 }); // A se vuelve más reciente
      setCachedTotal('u1', { a: 4 }, 4); // debe evictar B (a:2), no A
      expect(getCachedTotal('u1', { a: 1 })).toBe(1);
      expect(getCachedTotal('u1', { a: 2 })).toBeNull();
      expect(getCachedTotal('u1', { a: 3 })).toBe(3);
      expect(getCachedTotal('u1', { a: 4 })).toBe(4);
    });
  });

  describe('cap', () => {
    it('no supera maxEntries', () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 3 });
      setCachedTotal('u1', { a: 1 }, 1);
      setCachedTotal('u1', { a: 2 }, 2);
      setCachedTotal('u1', { a: 3 }, 3);
      setCachedTotal('u1', { a: 4 }, 4);
      setCachedTotal('u1', { a: 5 }, 5);
      expect(getCachedTotal('u1', { a: 1 })).toBeNull();
      expect(getCachedTotal('u1', { a: 2 })).toBeNull();
      expect(getCachedTotal('u1', { a: 3 })).toBe(3);
      expect(getCachedTotal('u1', { a: 4 })).toBe(4);
      expect(getCachedTotal('u1', { a: 5 })).toBe(5);
    });
  });
});
