import { describe, it, expect } from 'vitest';
import {
  amenityFiltersToAndList,
  canonicalizeAmenityToken,
  amenityTokenToOrWhere,
} from '../amenity-filter.js';

describe('canonicalizeAmenityToken', () => {
  it('unifica sinónimos a clave canónica', () => {
    expect(canonicalizeAmenityToken('estacionamiento')).toBe('cochera');
    expect(canonicalizeAmenityToken('piscina')).toBe('pileta');
    expect(canonicalizeAmenityToken('jardin')).toBe('jardín');
  });
});

describe('amenityTokenToOrWhere', () => {
  it('expande pileta a múltiples condiciones OR', () => {
    const w = amenityTokenToOrWhere('pileta');
    expect(w).toBeTruthy();
    const orList =
      w && 'OR' in w && Array.isArray((w as { OR: unknown }).OR) ? (w as { OR: unknown[] }).OR : [];
    expect(orList.length).toBeGreaterThan(3);
    const json = JSON.stringify(w);
    expect(json).toContain('pileta');
    expect(json).toContain('piscina');
  });
});

describe('amenityFiltersToAndList', () => {
  it('deduplica cochera y estacionamiento', () => {
    const list = amenityFiltersToAndList(['cochera', 'estacionamiento']);
    expect(list).toHaveLength(1);
  });
});
