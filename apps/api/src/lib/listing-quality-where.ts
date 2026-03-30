/**
 * Filtros de calidad del catálogo user-facing (feed, mapa, búsquedas, alertas).
 * - Antigüedad máxima: FEED_MAX_LISTING_AGE_YEARS (default 4).
 * - Requiere al menos una señal visual: fotos (photosCount), filas en media, o hero no vacío.
 */

function parseYears(): number {
  const n = Number(process.env.FEED_MAX_LISTING_AGE_YEARS ?? 4);
  if (!Number.isFinite(n) || n < 1) return 4;
  return Math.min(50, Math.floor(n));
}

export function listingMinCreatedAt(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - parseYears());
  return d;
}

/** Objetos para combinar con AND en un where de Prisma. */
export function listingQualityAndClauses(): Record<string, unknown>[] {
  return [
    { createdAt: { gte: listingMinCreatedAt() } },
    {
      OR: [
        { photosCount: { gt: 0 } },
        { media: { some: {} } },
        {
          AND: [{ heroImageUrl: { not: null } }, { NOT: { heroImageUrl: '' } }],
        },
      ],
    },
  ];
}

/** Añade las cláusulas de calidad a `where.AND` (muta y devuelve el mismo objeto). */
export function mergeListingQualityWhere(where: Record<string, unknown>): Record<string, unknown> {
  const clauses = listingQualityAndClauses();
  const prev = where.AND;
  const prevArr = Array.isArray(prev) ? prev : prev != null ? [prev] : [];
  where.AND = [...prevArr, ...clauses];
  return where;
}
