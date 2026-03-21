import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseZonapropXmlDocument, getXmlText } from '../connectors/kiteprop-difusion-zonaprop.js';

const OPEN_FIXTURE = join(
  process.cwd(),
  'src/services/ingest/fixtures/zonaprop-opennavent-sample.xml'
);
const LEGACY_FIXTURE = join(
  process.cwd(),
  'src/services/ingest/fixtures/zonaprop-sample.xml'
);

describe('parseZonapropXmlDocument (OpenNavent)', () => {
  it('parsea 3 Avisos del fixture opennavent', () => {
    const xml = readFileSync(OPEN_FIXTURE, 'utf-8');
    const items = parseZonapropXmlDocument(xml);
    expect(items.length).toBe(3);
    expect(items[0]?._parser).toBe('opennavent');
    expect(items[0]?.id).toBe('999001');
  });

  it('extrae precio, ubicación, dorm/baños y amenities desde caracteristicas', () => {
    const xml = readFileSync(OPEN_FIXTURE, 'utf-8');
    const items = parseZonapropXmlDocument(xml);
    const first = items[0] as Record<string, unknown>;
    expect(first.price).toBe('250000');
    expect(first.currency).toBe('USD');
    expect(first.bedrooms).toBe('3');
    expect(first.bathrooms).toBe('2');
    expect(first.location_text).toContain('Funes');
    const det = first.detailsPayload as { amenities?: string[]; pileta?: boolean };
    expect(det.amenities).toContain('pileta');
    expect(det.amenities).toContain('jardín');
    expect(det.pileta).toBe(true);
  });

  it('legacy listing fixture sigue devolviendo 3 ítems', () => {
    const xml = readFileSync(LEGACY_FIXTURE, 'utf-8');
    const items = parseZonapropXmlDocument(xml);
    expect(items.length).toBe(3);
    expect(items[0]?._parser).toBe('legacy');
  });

  it('getXmlText lee CDATA', () => {
    const block = '<titulo><![CDATA[Hola]]></titulo>';
    expect(getXmlText(block, 'titulo')).toBe('Hola');
  });
});
