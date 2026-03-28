import { describe, it, expect } from 'vitest';
import { parseSearchText } from '../search-parser.js';

describe('parseSearchText', () => {
  it('detecta venta', () => {
    const r = parseSearchText('quiero comprar un departamento');
    expect(r.filters.operationType).toBe('SALE');
  });

  it('detecta alquiler', () => {
    const r = parseSearchText('busco alquiler en Palermo');
    expect(r.filters.operationType).toBe('RENT');
  });

  it('detecta rent en inglés', () => {
    const r = parseSearchText('apartment for rent');
    expect(r.filters.operationType).toBe('RENT');
  });

  it('detecta USD', () => {
    const r = parseSearchText('hasta 100k USD');
    expect(r.filters.currency).toBe('USD');
    expect(r.filters.priceMax).toBe(100000);
  });

  it('detecta hasta 100.000', () => {
    const r = parseSearchText('hasta 100.000');
    expect(r.filters.priceMax).toBe(100000);
  });

  it('detecta 2 dormitorios', () => {
    const r = parseSearchText('2 dormitorios en Palermo');
    expect(r.filters.bedroomsMin).toBe(2);
  });

  it('detecta 3 ambientes', () => {
    const r = parseSearchText('3 ambientes');
    expect(r.filters.bedroomsMin).toBe(3);
  });

  it('detecta ubicación "en Palermo"', () => {
    const r = parseSearchText('departamento en Palermo');
    expect(r.filters.locationText).toContain('Palermo');
  });

  it('detecta departamento y casa', () => {
    const r = parseSearchText('departamento o casa');
    expect(r.filters.propertyType).toContain('APARTMENT');
    expect(r.filters.propertyType).toContain('HOUSE');
  });

  it('texto vacío devuelve filtros vacíos', () => {
    const r = parseSearchText('   ');
    expect(Object.keys(r.filters)).toHaveLength(0);
    expect(r.explanation).toContain('No se detectó');
  });

  it('combinación completa', () => {
    const r = parseSearchText('departamento en Palermo, 2 dormitorios, hasta 150k USD, alquiler');
    expect(r.filters.operationType).toBe('RENT');
    expect(r.filters.propertyType).toContain('APARTMENT');
    expect(r.filters.locationText).toContain('Palermo');
    expect(r.filters.bedroomsMin).toBe(2);
    expect(r.filters.priceMax).toBe(150000);
    expect(r.filters.currency).toBe('USD');
  });

  it('100 mil pesos', () => {
    const r = parseSearchText('hasta 100 mil pesos');
    expect(r.filters.priceMax).toBe(100000);
  });

  it('presupuesto 60 mil', () => {
    const r = parseSearchText('Terreno en Funes, 400m2, presupuesto 60 mil');
    expect(r.filters.priceMax).toBe(60000);
    expect(r.filters.locationText).toBe('Funes');
    expect(r.filters.propertyType).toContain('LAND');
    expect(r.explanation).not.toMatch(/,\s*\./); // sin "hasta 60,000 ."
  });

  it('zona norte mantiene frase completa', () => {
    const r = parseSearchText('Alquiler casa 3 dorm zona norte');
    expect(r.filters.locationText).toBe('zona norte');
  });

  it('texto 1: depto 2 dorm Rosario 120k usd', () => {
    const r = parseSearchText('Quiero comprar depto 2 dorm en Rosario hasta 120k usd');
    expect(r.filters.operationType).toBe('SALE');
    expect(r.filters.currency).toBe('USD');
    expect(r.filters.priceMax).toBe(120000);
    expect(r.filters.bedroomsMin).toBe(2);
    expect(r.filters.locationText).toBe('Rosario');
    expect(r.filters.propertyType).toContain('APARTMENT');
    expect(r.explanation).toContain('dormitorios');
  });

  it('texto 2: alquiler casa 3 dormitorios zona norte 900k ars', () => {
    const r = parseSearchText('Alquiler casa 3 dormitorios zona norte, max 900k ars');
    expect(r.filters.operationType).toBe('RENT');
    expect(r.filters.currency).toBe('ARS');
    expect(r.filters.priceMax).toBe(900000);
    expect(r.filters.bedroomsMin).toBe(3);
    expect(r.filters.locationText).toBe('zona norte');
    expect(r.filters.propertyType).toContain('HOUSE');
    expect(r.explanation).toContain('dormitorios');
  });

  it('texto 3: terreno Funes 400m2 presupuesto 60 mil', () => {
    const r = parseSearchText('Terreno en Funes, 400m2, presupuesto 60 mil');
    expect(r.filters.propertyType).toContain('LAND');
    expect(r.filters.locationText).toBe('Funes');
    expect(r.filters.areaMin).toBe(400);
    expect(r.filters.priceMax).toBe(60000);
    expect(r.filters.currency).toBeUndefined();
    expect(r.explanation).toContain('moneda no especificada');
  });

  describe('regresión: filters NO vacío para textos de prueba', () => {
    it('texto 1: Quiero comprar depto 2 dorm en Rosario hasta 120k usd', () => {
      const r = parseSearchText('Quiero comprar depto 2 dorm en Rosario hasta 120k usd');
      expect(Object.keys(r.filters).length).toBeGreaterThan(0);
      expect(r.filters.operationType).toBe('SALE');
      expect(r.filters.priceMax).toBe(120000);
      expect(r.filters.currency).toBe('USD');
      expect(r.filters.bedroomsMin).toBe(2);
      expect(r.filters.locationText).toContain('Rosario');
      expect(r.filters.propertyType).toContain('APARTMENT');
      expect(r.warnings).toEqual([]);
    });

    it('texto 2: Alquiler casa 3 dormitorios zona norte, max 900k ars', () => {
      const r = parseSearchText('Alquiler casa 3 dormitorios zona norte, max 900k ars');
      expect(Object.keys(r.filters).length).toBeGreaterThan(0);
      expect(r.filters.operationType).toBe('RENT');
      expect(r.filters.priceMax).toBe(900000);
      expect(r.filters.currency).toBe('ARS');
      expect(r.filters.bedroomsMin).toBe(3);
      expect(r.filters.locationText).toContain('zona norte');
      expect(r.filters.propertyType).toContain('HOUSE');
      expect(r.warnings).toEqual([]);
    });

    it('texto 3: Terreno en Funes, 400m2, presupuesto 60 mil', () => {
      const r = parseSearchText('Terreno en Funes, 400m2, presupuesto 60 mil');
      expect(Object.keys(r.filters).length).toBeGreaterThan(0);
      expect(r.filters.priceMax).toBe(60000);
      expect(r.filters.areaMin).toBe(400);
      expect(r.filters.locationText).toContain('Funes');
      expect(r.filters.propertyType).toContain('LAND');
      expect(r.warnings).toEqual([]);
    });
  });

  describe('regresión: precio NO por número de dormitorios', () => {
    it('alquiler 2 dormitorios rosario: priceMax NO debe ser 2', () => {
      const r = parseSearchText('alquiler 2 dormitorios rosario');
      expect(r.filters.operationType).toBe('RENT');
      expect(r.filters.bedroomsMin).toBe(2);
      expect(r.filters.locationText?.toLowerCase()).toContain('rosario');
      expect(r.filters.priceMax).toBeUndefined();
      expect(r.filters.priceMax).not.toBe(2);
    });

    it('depto en venta 3 dormis 100k usd', () => {
      const r = parseSearchText('depto en venta 3 dormis 100k usd');
      expect(r.filters.bedroomsMin).toBe(3);
      expect(r.filters.priceMax).toBe(100000);
      expect(r.filters.currency).toBe('USD');
    });

    it('Terreno en Funes 400m2 presupuesto 60 mil', () => {
      const r = parseSearchText('Terreno en Funes 400m2 presupuesto 60 mil');
      expect(r.filters.areaMin).toBe(400);
      expect(r.filters.priceMax).toBe(60000);
      expect(r.filters.currency).toBeUndefined();
    });
  });

  it('detecta precio mínimo (desde)', () => {
    const r = parseSearchText('casa desde 50 mil USD');
    expect(r.filters.priceMin).toBe(50000);
    expect(r.filters.currency).toBe('USD');
  });

  it('detecta máximo dormitorios', () => {
    const r = parseSearchText('depto máximo 2 ambientes en Palermo');
    expect(r.filters.bedroomsMax).toBe(2);
    expect(r.filters.bedroomsMin).toBeUndefined();
  });

  it('detecta ordenar por precio', () => {
    const r = parseSearchText('casa más baratas en Rosario');
    expect(r.filters.sortBy).toBe('price_asc');
  });

  it('detecta publicaciones recientes', () => {
    const r = parseSearchText('depto nuevas en CABA');
    expect(r.filters.listingAgeDays).toBe(7);
  });

  describe('warnings', () => {
    it('textos con filtros: warnings vacío', () => {
      const t1 = parseSearchText('departamento en Palermo');
      const t2 = parseSearchText('alquiler casa 2 dorm hasta 100k');
      const t3 = parseSearchText('Terreno en Funes, 400m2, presupuesto 60 mil');
      expect(t1.warnings).toEqual([]);
      expect(t2.warnings).toEqual([]);
      expect(t3.warnings).toEqual([]);
    });

    it('texto sin criterios: warnings tiene 1 item', () => {
      const r1 = parseSearchText('hola');
      const r2 = parseSearchText('quiero ver algo');
      expect(r1.warnings).toHaveLength(1);
      expect(r2.warnings).toHaveLength(1);
      expect(r1.warnings[0]).toContain('No entendí criterios');
      expect(r2.warnings[0]).toContain('No entendí criterios');
    });
  });

  it('hasta N m² no setea areaMin (solo areaMax)', () => {
    const r = parseSearchText('departamento hasta 100 m2 en Palermo');
    expect(r.filters.areaMax).toBe(100);
    expect(r.filters.areaMin).toBeUndefined();
  });

  it('detecta m² cubiertos mínimos', () => {
    const r = parseSearchText('casa con 120 m2 cubiertos en Pilar');
    expect(r.filters.areaCoveredMin).toBe(120);
    expect(r.filters.locationText).toContain('Pilar');
  });

  it('detecta calle en addressText', () => {
    const r = parseSearchText('depto en calle Corrientes');
    expect(r.filters.addressText).toMatch(/Corrientes/i);
  });

  it('detecta título y descripción', () => {
    const r = parseSearchText('casa título con "luminoso" descripción con "pileta"');
    expect(r.filters.titleContains).toBe('luminoso');
    expect(r.filters.descriptionContains).toBe('pileta');
  });

  it('detecta palabras clave', () => {
    const r = parseSearchText('ph palabras clave: luminoso, reciclado');
    expect(r.filters.keywords).toEqual(['luminoso', 'reciclado']);
  });

  it('detecta origen Zonaprop', () => {
    const r = parseSearchText('depto en venta publicado en Zonaprop');
    expect(r.filters.source).toBe('KITEPROP_DIFUSION_ZONAPROP');
  });

  describe('amenidades (asistente)', () => {
    it('detecta pileta, quincho y chimenea', () => {
      const r = parseSearchText('casa con pileta, quincho y chimenea en Pilar');
      expect(r.filters.amenities).toEqual(
        expect.arrayContaining(['pileta', 'quincho', 'chimenea'])
      );
      expect(r.warnings).toEqual([]);
    });

    it('estacionamiento → cochera canónica', () => {
      const r = parseSearchText('departamento con estacionamiento en Belgrano');
      expect(r.filters.amenities).toContain('cochera');
    });

    it('separa terraza y balcón', () => {
      const r = parseSearchText('semipiso con terraza y balcón');
      expect(r.filters.amenities).toEqual(expect.arrayContaining(['terraza', 'balcón']));
    });

    it('SUM por nombre o sigla', () => {
      const a = parseSearchText('edificio con SUM en Nuñez');
      const b = parseSearchText('salón de usos múltiples');
      expect(a.filters.amenities).toContain('SUM');
      expect(b.filters.amenities).toContain('SUM');
    });
  });
});
