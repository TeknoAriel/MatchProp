/**
 * Unifica propertyType al salir del ingest: enum coherente con feed / búsquedas.
 * Listing.propertyType es String? en Prisma; valores canónicos HOUSE | APARTMENT | LAND | OFFICE | OTHER.
 */

const CANON = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;
export type CanonicalPropertyType = (typeof CANON)[number];

const CANON_SET = new Set<string>(CANON);

/** Texto libre (es/en) → canónico */
const PHRASE_TO_TYPE: Record<string, CanonicalPropertyType> = {
  // ya canónicos lower
  house: 'HOUSE',
  casa: 'HOUSE',
  casas: 'HOUSE',
  chalet: 'HOUSE',
  chalets: 'HOUSE',
  quinta: 'HOUSE',
  cabana: 'HOUSE',
  cabaña: 'HOUSE',
  duplex: 'HOUSE',
  dúplex: 'HOUSE',
  apartment: 'APARTMENT',
  apartments: 'APARTMENT',
  departamento: 'APARTMENT',
  departamentos: 'APARTMENT',
  depto: 'APARTMENT',
  deptos: 'APARTMENT',
  ph: 'APARTMENT',
  monoambiente: 'APARTMENT',
  loft: 'APARTMENT',
  piso: 'APARTMENT',
  land: 'LAND',
  terreno: 'LAND',
  terrenos: 'LAND',
  lote: 'LAND',
  lotes: 'LAND',
  campo: 'LAND',
  office: 'OFFICE',
  oficina: 'OFFICE',
  oficinas: 'OFFICE',
  local: 'OFFICE',
  locales: 'OFFICE',
  comercial: 'OFFICE',
  galpon: 'OFFICE',
  galpón: 'OFFICE',
  nave: 'OFFICE',
  retail: 'OFFICE',
  retail_spaces: 'OFFICE',
  residential_lands: 'LAND',
  houses: 'HOUSE',
  cochera: 'OTHER',
  cocheras: 'OTHER',
  garage: 'OTHER',
  otros: 'OTHER',
  other: 'OTHER',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * null si el conector no mandó tipo; string canónico si hubo texto (desconocido → OTHER).
 */
export function normalizeIngestPropertyType(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;

  const upper = t.toUpperCase().replace(/\s+/g, '_');
  if (CANON_SET.has(upper)) return upper;

  const key = stripAccents(t)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const single = key.replace(/ /g, '');
  const mapped = PHRASE_TO_TYPE[key] ?? PHRASE_TO_TYPE[single];
  if (mapped) return mapped;

  const firstToken = key.split(/\s+/)[0] ?? '';
  const fromToken = PHRASE_TO_TYPE[firstToken];
  if (fromToken) return fromToken;

  return 'OTHER';
}
