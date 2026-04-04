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
    it('get sin set devuelve null', async () => {
      const { getCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      await expect(getCachedTotal('u1', {})).resolves.toBeNull();
    });

    it('set luego get devuelve el valor', async () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      await setCachedTotal('u1', { operation: 'SALE' }, 42);
      await expect(getCachedTotal('u1', { operation: 'SALE' })).resolves.toBe(42);
    });
  });

  describe('normalización en cache key', () => {
    it('propertyTypes en distinto orden comparten cache', async () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 10 });
      await setCachedTotal('u1', { propertyTypes: ['HOUSE', 'APARTMENT'] }, 10);
      await expect(getCachedTotal('u1', { propertyTypes: ['APARTMENT', 'HOUSE'] })).resolves.toBe(
        10
      );
    });
  });

  describe('LRU eviction', () => {
    it('con maxEntries=3 evicta el menos reciente, no el recién accedido', async () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 3 });
      await setCachedTotal('u1', { a: 1 }, 1);
      await setCachedTotal('u1', { a: 2 }, 2);
      await setCachedTotal('u1', { a: 3 }, 3);
      await getCachedTotal('u1', { a: 1 }); // A se vuelve más reciente
      await setCachedTotal('u1', { a: 4 }, 4); // debe evictar B (a:2), no A
      await expect(getCachedTotal('u1', { a: 1 })).resolves.toBe(1);
      await expect(getCachedTotal('u1', { a: 2 })).resolves.toBeNull();
      await expect(getCachedTotal('u1', { a: 3 })).resolves.toBe(3);
      await expect(getCachedTotal('u1', { a: 4 })).resolves.toBe(4);
    });
  });

  describe('cap', () => {
    it('no supera maxEntries', async () => {
      const { getCachedTotal, setCachedTotal } = createFeedTotalCache({ maxEntries: 3 });
      await setCachedTotal('u1', { a: 1 }, 1);
      await setCachedTotal('u1', { a: 2 }, 2);
      await setCachedTotal('u1', { a: 3 }, 3);
      await setCachedTotal('u1', { a: 4 }, 4);
      await setCachedTotal('u1', { a: 5 }, 5);
      await expect(getCachedTotal('u1', { a: 1 })).resolves.toBeNull();
      await expect(getCachedTotal('u1', { a: 2 })).resolves.toBeNull();
      await expect(getCachedTotal('u1', { a: 3 })).resolves.toBe(3);
      await expect(getCachedTotal('u1', { a: 4 })).resolves.toBe(4);
      await expect(getCachedTotal('u1', { a: 5 })).resolves.toBe(5);
    });
  });
});
