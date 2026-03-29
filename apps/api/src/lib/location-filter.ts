/**
 * Ubicación más precisa: varias palabras ⇒ todas deben aparecer (AND),
 * en locationText, addressText o (si hay 2+ tokens) también en title.
 */
const LOCATION_STOPWORDS = new Set([
  'en',
  'el',
  'la',
  'de',
  'y',
  'o',
  'a',
  'las',
  'los',
  'del',
  'al',
  'un',
  'una',
  'unos',
  'unas',
  'the',
  'and',
]);

function tokenizeLocation(raw: string): string[] {
  const tokens = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !LOCATION_STOPWORDS.has(s.toLowerCase()));
  return [...new Set(tokens)].slice(0, 8);
}

/** Fragmento Prisma para combinar con where.AND */
export function locationTextToPrismaClause(locationText: string): Record<string, unknown> | null {
  const raw = locationText.trim();
  if (!raw) return null;
  const tokens = tokenizeLocation(raw);
  if (tokens.length === 0) {
    return { locationText: { contains: raw.slice(0, 200), mode: 'insensitive' } };
  }
  if (tokens.length === 1) {
    const t = tokens[0]!;
    return {
      OR: [
        { locationText: { contains: t, mode: 'insensitive' } },
        { addressText: { contains: t, mode: 'insensitive' } },
      ],
    };
  }
  return {
    AND: tokens.map((token) => ({
      OR: [
        { locationText: { contains: token, mode: 'insensitive' } },
        { addressText: { contains: token, mode: 'insensitive' } },
        { title: { contains: token, mode: 'insensitive' } },
      ],
    })),
  };
}
