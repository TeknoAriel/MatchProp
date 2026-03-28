import { describe, it, expect } from 'vitest';
import { locationTextToPrismaClause } from '../location-filter.js';

describe('locationTextToPrismaClause', () => {
  it('una palabra: OR ubicación y dirección', () => {
    const w = locationTextToPrismaClause('Palermo');
    expect(w).toMatchObject({
      OR: expect.arrayContaining([
        { locationText: { contains: 'Palermo', mode: 'insensitive' } },
        { addressText: { contains: 'Palermo', mode: 'insensitive' } },
      ]),
    });
  });

  it('varias palabras: AND de tokens (más precisión)', () => {
    const w = locationTextToPrismaClause('Rosario Funes');
    expect(w).toEqual({
      AND: [
        {
          OR: [
            { locationText: { contains: 'Rosario', mode: 'insensitive' } },
            { addressText: { contains: 'Rosario', mode: 'insensitive' } },
            { title: { contains: 'Rosario', mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { locationText: { contains: 'Funes', mode: 'insensitive' } },
            { addressText: { contains: 'Funes', mode: 'insensitive' } },
            { title: { contains: 'Funes', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });
});
