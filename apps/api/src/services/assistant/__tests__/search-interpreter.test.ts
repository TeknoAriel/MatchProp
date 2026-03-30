import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    assistantConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { interpretSearchQuery } from '../search-interpreter.js';

describe('interpretSearchQuery (sin LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"quiero comprar una casa" → venta + casa', async () => {
    const r = await interpretSearchQuery({
      text: 'quiero comprar una casa',
      llm: null,
    });
    expect(r.filters.operationType).toBe('SALE');
    expect(r.filters.propertyType).toContain('HOUSE');
    expect(r.intent?.operation).toBe('SALE');
  });

  it('"quiero mi casa con jardín y piscina" → venta, casa, amenities', async () => {
    const r = await interpretSearchQuery({
      text: 'quiero mi casa con jardín y piscina',
      llm: null,
    });
    expect(r.filters.operationType).toBe('SALE');
    expect(r.filters.propertyType).toContain('HOUSE');
    expect(r.filters.amenities?.join(' ').toLowerCase()).toMatch(/jardín|pileta/);
  });

  it('"busco un depto de 2 dormitorios con balcón"', async () => {
    const r = await interpretSearchQuery({
      text: 'busco un depto de 2 dormitorios con balcón',
      llm: null,
    });
    expect(r.filters.propertyType).toContain('APARTMENT');
    expect(r.filters.bedroomsMin).toBe(2);
    expect(r.filters.amenities?.join(' ').toLowerCase()).toContain('balcón');
  });

  it('"necesito alquilar algo con cochera"', async () => {
    const r = await interpretSearchQuery({
      text: 'necesito alquilar algo con cochera',
      llm: null,
    });
    expect(r.filters.operationType).toBe('RENT');
    expect(r.filters.amenities?.length).toBeGreaterThan(0);
  });

  it('"quiero algo barato por el centro" → sort + zona', async () => {
    const r = await interpretSearchQuery({
      text: 'quiero algo barato por el centro',
      llm: null,
    });
    expect(r.filters.sortBy).toBe('price_asc');
    expect(r.filters.locationText?.toLowerCase()).toContain('centro');
  });

  it('"quiero una casa para mi familia" → soft familia', async () => {
    const r = await interpretSearchQuery({
      text: 'quiero una casa para mi familia',
      llm: null,
    });
    expect(r.filters.propertyType).toContain('HOUSE');
    expect(r.intent?.softPreferences?.join(' ')).toMatch(/familia/i);
  });

  it('"algo moderno con patio y parrilla"', async () => {
    const r = await interpretSearchQuery({
      text: 'algo moderno con patio y parrilla',
      llm: null,
    });
    expect(r.intent?.softPreferences).toContain('moderno');
    expect(r.filters.amenities?.length).toBeGreaterThan(0);
  });

  it('"quiero invertir en un lote" → venta + terreno', async () => {
    const r = await interpretSearchQuery({
      text: 'quiero invertir en un lote',
      llm: null,
    });
    expect(r.filters.operationType).toBe('SALE');
    expect(r.filters.propertyType).toContain('LAND');
  });

  it('refinamiento: más barato con previousFilters', async () => {
    const r = await interpretSearchQuery({
      text: 'mostrame algo parecido pero más barato',
      previousFilters: {
        operationType: 'SALE',
        propertyType: ['APARTMENT'],
        priceMax: 200_000,
        locationText: 'Palermo',
      },
      llm: null,
    });
    expect(r.filters.sortBy).toBe('price_asc');
    expect(r.filters.propertyType).toContain('APARTMENT');
    expect(r.filters.priceMax).toBeLessThanOrEqual(200_000);
  });

  it('"prefiero departamento y no casa" con prev casa', async () => {
    const r = await interpretSearchQuery({
      text: 'prefiero departamento y no casa',
      previousFilters: {
        operationType: 'SALE',
        propertyType: ['HOUSE'],
      },
      llm: null,
    });
    expect(r.filters.propertyType).toEqual(['APARTMENT']);
  });
});
