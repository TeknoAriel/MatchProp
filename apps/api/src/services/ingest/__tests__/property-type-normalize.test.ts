import { describe, it, expect } from 'vitest';
import { normalizeIngestPropertyType } from '../property-type-normalize.js';

describe('normalizeIngestPropertyType', () => {
  it('null, undefined y vacío → null', () => {
    expect(normalizeIngestPropertyType(null)).toBeNull();
    expect(normalizeIngestPropertyType(undefined)).toBeNull();
    expect(normalizeIngestPropertyType('')).toBeNull();
    expect(normalizeIngestPropertyType('   ')).toBeNull();
  });

  it('enum canónico en mayúsculas o con espacios', () => {
    expect(normalizeIngestPropertyType('HOUSE')).toBe('HOUSE');
    expect(normalizeIngestPropertyType('apartment')).toBe('APARTMENT');
    expect(normalizeIngestPropertyType('LAND')).toBe('LAND');
    expect(normalizeIngestPropertyType('OFFICE')).toBe('OFFICE');
    expect(normalizeIngestPropertyType('OTHER')).toBe('OTHER');
  });

  it('mapea frases y claves con guiones/underscores', () => {
    expect(normalizeIngestPropertyType('casa')).toBe('HOUSE');
    expect(normalizeIngestPropertyType('departamento')).toBe('APARTMENT');
    expect(normalizeIngestPropertyType('retail_spaces')).toBe('OFFICE');
    expect(normalizeIngestPropertyType('residential_lands')).toBe('LAND');
    expect(normalizeIngestPropertyType('galpón')).toBe('OFFICE');
  });

  it('desconocido → OTHER', () => {
    expect(normalizeIngestPropertyType('bodega misteriosa')).toBe('OTHER');
    expect(normalizeIngestPropertyType('xyz123')).toBe('OTHER');
  });
});
