/**
 * Filtros por amenidades: sinónimos → clave canónica y expansión en WHERE (título, descripción, details).
 */

export type AmenitySpec = {
  /** Subcadenas para buscar en title/description (evitar términos de 1 letra). */
  contains: string[];
  /** Valores posibles dentro de details.amenities (JSON array). */
  arrayValues: string[];
  /** Campo booleano en details, si existe en ingest. */
  boolPath?: string;
};

function uniqShortStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const t = x.trim();
    if (t.length < 2) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Definición por clave canónica (misma convención que la UI y el parser). */
export const AMENITY_SPECS: Record<string, AmenitySpec> = {
  pileta: {
    contains: ['pileta', 'piscina', 'pool'],
    arrayValues: ['pileta', 'piscina', 'pool'],
    boolPath: 'pileta',
  },
  cochera: {
    contains: [
      'cochera',
      'cocheras',
      'garage',
      'garages',
      'estacionamiento',
      'estacionamientos',
      'playa de estacionamiento',
      'playa de cochera',
    ],
    arrayValues: ['cochera', 'cocheras', 'garage', 'garages', 'estacionamiento'],
    boolPath: 'cochera',
  },
  jardín: {
    contains: ['jardín', 'jardin', 'patio', 'patios', 'parque', 'verde'],
    arrayValues: ['jardín', 'jardin', 'patio', 'patios'],
    boolPath: 'jardin',
  },
  parrilla: {
    contains: [
      'parrilla',
      'parrillas',
      'asador',
      'asadores',
      'churrasquera',
      'churrasqueras',
      'bbq',
      'barbacoa',
    ],
    arrayValues: ['parrilla', 'parrillas', 'asador', 'churrasquera', 'barbacoa'],
    boolPath: 'parrilla',
  },
  quincho: {
    contains: ['quincho', 'quinchos'],
    arrayValues: ['quincho', 'quinchos'],
  },
  gimnasio: {
    contains: ['gimnasio', 'gimnasios', 'gym'],
    arrayValues: ['gimnasio', 'gimnasios', 'gym'],
    boolPath: 'gimnasio',
  },
  amoblado: {
    contains: ['amoblado', 'amoblada', 'amueblado', 'amueblada', 'muebles'],
    arrayValues: ['amoblado', 'amueblado'],
  },
  'aire acondicionado': {
    contains: [
      'aire acondicionado',
      'aire acondicionada',
      'climatizado',
      'climatizada',
      'split',
      'splits',
      'frío calor',
      'frio calor',
      'ac split',
    ],
    arrayValues: ['aire acondicionado', 'aire acondicionada', 'split', 'ac'],
  },
  calefacción: {
    contains: ['calefacción', 'calefaccion', 'caldera', 'radiadores', 'piso radiante'],
    arrayValues: ['calefacción', 'calefaccion', 'caldera'],
  },
  chimenea: {
    contains: ['chimenea', 'chimeneas', 'hogar a leña'],
    arrayValues: ['chimenea', 'chimeneas'],
  },
  seguridad: {
    contains: ['seguridad', 'portería', 'porteria', 'encargado', 'vigilancia privada'],
    arrayValues: ['seguridad', 'encargado'],
  },
  ascensor: {
    contains: ['ascensor', 'ascensores', 'elevador', 'elevadores'],
    arrayValues: ['ascensor', 'ascensores', 'elevador'],
  },
  terraza: {
    contains: ['terraza', 'terrazas', 'roof garden', 'rooftop'],
    arrayValues: ['terraza', 'terrazas', 'roof garden'],
  },
  balcón: {
    contains: ['balcón', 'balcon', 'balcones'],
    arrayValues: ['balcón', 'balcon', 'balcones'],
  },
  lavadero: {
    contains: ['lavadero', 'lavaderos'],
    arrayValues: ['lavadero', 'lavaderos'],
  },
  SUM: {
    contains: [
      'SUM',
      'sum',
      'salón de usos múltiples',
      'salon de usos multiples',
      'usos múltiples',
      'usos multiples',
    ],
    arrayValues: ['SUM', 'sum', 'salón de usos múltiples', 'salon de usos multiples'],
  },
  alarma: {
    contains: ['alarma', 'alarmas'],
    arrayValues: ['alarma', 'alarmas'],
  },
  baulera: {
    contains: ['baulera', 'bauleras', 'depósito', 'deposito', 'bodega'],
    arrayValues: ['baulera', 'bauleras', 'depósito', 'deposito'],
  },
  'energía solar': {
    contains: ['energía solar', 'energia solar', 'paneles solares', 'panel solar'],
    arrayValues: ['energía solar', 'energia solar', 'paneles solares'],
  },
  mascotas: {
    contains: ['mascotas', 'mascota', 'pet friendly', 'acepta mascotas', 'permite mascotas'],
    arrayValues: ['mascotas', 'pet friendly'],
  },
  hidromasaje: {
    contains: ['hidromasaje', 'hidromasajes', 'jacuzzi', 'yacuzzi'],
    arrayValues: ['hidromasaje', 'jacuzzi'],
  },
  sauna: {
    contains: ['sauna', 'saunas'],
    arrayValues: ['sauna', 'saunas'],
  },
  vigilancia: {
    contains: ['vigilancia', 'circuito cerrado', 'cámaras', 'camaras'],
    arrayValues: ['vigilancia', 'circuito cerrado'],
  },
  'internet wifi': {
    contains: ['internet wifi', 'wi-fi', 'wifi', 'inalámbrico', 'inalambrico'],
    arrayValues: ['internet wifi', 'wifi', 'internet'],
  },
  solarium: {
    contains: ['solarium', 'solárium'],
    arrayValues: ['solarium', 'solárium'],
  },
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');
}

const SYNONYM_TO_CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (syn: string, canonical: string) => {
    const k = normalizeKey(syn);
    if (!k) return;
    if (!m.has(k)) m.set(k, canonical);
  };
  for (const canonical of Object.keys(AMENITY_SPECS)) {
    add(canonical, canonical);
    const spec = AMENITY_SPECS[canonical];
    if (!spec) continue;
    for (const s of spec.contains) add(s, canonical);
    for (const s of spec.arrayValues) add(s, canonical);
  }
  // Alias explícitos (UI / voz / typos)
  add('cocheras', 'cochera');
  add('estacionamiento', 'cochera');
  add('estacionamientos', 'cochera');
  add('garaje', 'cochera');
  add('jardin', 'jardín');
  add('patio', 'jardín');
  add('aire_acondicionado', 'aire acondicionado');
  add('aire-acondicionado', 'aire acondicionado');
  add('calefaccion', 'calefacción');
  add('balcon', 'balcón');
  add('usos multiples', 'SUM');
  add('salon sum', 'SUM');
  return m;
})();

/** Convierte token de filtro (UI, parser, querystring) a clave canónica si se reconoce. */
export function canonicalizeAmenityToken(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const k = normalizeKey(t);
  return SYNONYM_TO_CANONICAL.get(k) ?? t;
}

function specForToken(raw: string): AmenitySpec | null {
  const c = canonicalizeAmenityToken(raw);
  return AMENITY_SPECS[c] ?? null;
}

function orConditionFromSpec(spec: AmenitySpec): Record<string, unknown>[] {
  const ors: Record<string, unknown>[] = [];
  for (const sub of uniqShortStrings(spec.contains)) {
    ors.push({ description: { contains: sub, mode: 'insensitive' } });
    ors.push({ title: { contains: sub, mode: 'insensitive' } });
  }
  for (const v of uniqShortStrings(spec.arrayValues)) {
    ors.push({ details: { path: ['amenities'], array_contains: [v] } });
  }
  if (spec.boolPath) {
    ors.push({ details: { path: [spec.boolPath], equals: true } });
  }
  return ors;
}

/** Un bloque OR de Prisma para un token de amenity (o null si vacío). */
export function amenityTokenToOrWhere(raw: string): Record<string, unknown> | null {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const spec = specForToken(trimmed);
  if (spec) {
    const ors = orConditionFromSpec(spec);
    return ors.length ? { OR: ors } : null;
  }
  return {
    OR: [
      { description: { contains: trimmed, mode: 'insensitive' } },
      { title: { contains: trimmed, mode: 'insensitive' } },
      { details: { path: ['amenities'], array_contains: [trimmed] } },
    ],
  };
}

/** Lista de cláusulas AND (cada amenity es un AND sobre un OR interno). */
export function amenityFiltersToAndList(amenityTokens: string[]): Record<string, unknown>[] {
  const andList: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const raw of amenityTokens) {
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const canon = canonicalizeAmenityToken(trimmed);
    const dedupeKey = normalizeKey(canon);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const block = amenityTokenToOrWhere(trimmed);
    if (block) andList.push(block);
  }
  return andList;
}
