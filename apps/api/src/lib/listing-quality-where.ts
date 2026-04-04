/**
 * Filtros de calidad del catálogo user-facing (feed, mapa, búsquedas, alertas).
 * - Antigüedad máxima: FEED_MAX_LISTING_AGE_YEARS (default 25).
 * - Señal visual (opcional): si FEED_STRICT_VISUAL=1 → photosCount, media, hero o rawJson.
 *   Sin esa env, solo se aplica el recorte por antigüedad (catálogo ingest a veces sin fotos en columnas).
 *
 * Flujo típico de listado: Browser → Next `/api/*` rewrite → API `GET /feed` o `/feed/map`
 * → Prisma `listing.findMany` con `status: ACTIVE` + filtros de búsqueda + estas cláusulas.
 * Si aquí queda 0 filas, no es fallo de “conexión a DB”: el where excluye el inventario.
 */

import { Prisma } from '@prisma/client';

function parseYears(): number {
  const n = Number(process.env.FEED_MAX_LISTING_AGE_YEARS ?? 25);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(50, Math.floor(n));
}

export function listingMinCreatedAt(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - parseYears());
  return d;
}

/** Objetos para combinar con AND en un where de Prisma. */
export function listingQualityAndClauses(): Record<string, unknown>[] {
  const age: Record<string, unknown> = { createdAt: { gte: listingMinCreatedAt() } };
  if (process.env.FEED_STRICT_VISUAL !== '1') {
    return [age];
  }
  return [
    age,
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
