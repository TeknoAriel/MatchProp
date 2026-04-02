/**
 * Filtros de calidad del catálogo user-facing (feed, mapa, búsquedas, alertas).
 * - Antigüedad máxima: FEED_MAX_LISTING_AGE_YEARS (default 4).
 * - Señal visual: photosCount, filas en media, hero, o **rawJson** (payload del conector;
 *   el card usa extractFromRawJson en feed-listing-card).
 *
 * Flujo típico de listado: Browser → Next `/api/*` rewrite → API `GET /feed` o `/feed/map`
 * → Prisma `listing.findMany` con `status: ACTIVE` + filtros de búsqueda + estas cláusulas.
 * Si aquí queda 0 filas, no es fallo de “conexión a DB”: el where excluye el inventario.
 */

import { Prisma } from '@prisma/client';

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
        { rawJson: { not: Prisma.DbNull } },
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
