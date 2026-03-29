/**
 * Niveles de usuario según volumen de interacción (UI progresiva).
 * Umbrales por total de interacciones (suma de las cuatro métricas).
 */
export type UserLevel = 'NEW' | 'ACTIVE' | 'ADVANCED';

/** Contadores por tipo de interacción (cada uno suma al total del nivel). */
export type UserEngagementStats = {
  swipes: number;
  searches: number;
  listingOpens: number;
  saves: number;
};

export const EMPTY_USER_ENGAGEMENT_STATS: UserEngagementStats = {
  swipes: 0,
  searches: 0,
  listingOpens: 0,
  saves: 0,
};

/** Límite inclusive para NEW y ACTIVE; por encima es ADVANCED. */
export const USER_LEVEL_NEW_MAX_TOTAL = 3;
export const USER_LEVEL_ACTIVE_MAX_TOTAL = 15;

function clampInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function totalEngagementInteractions(stats: UserEngagementStats): number {
  return (
    clampInt(stats.swipes) +
    clampInt(stats.searches) +
    clampInt(stats.listingOpens) +
    clampInt(stats.saves)
  );
}

/**
 * Devuelve el nivel según la suma de interacciones.
 * NEW: 0–3, ACTIVE: 4–15, ADVANCED: >15
 */
export function getUserLevel(stats: UserEngagementStats): UserLevel {
  const t = totalEngagementInteractions(stats);
  if (t <= USER_LEVEL_NEW_MAX_TOTAL) return 'NEW';
  if (t <= USER_LEVEL_ACTIVE_MAX_TOTAL) return 'ACTIVE';
  return 'ADVANCED';
}

function asNonNegInt(v: unknown): number {
  if (typeof v === 'number') return clampInt(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return clampInt(n);
  }
  return 0;
}

/** Normaliza un valor JSON parcial o desconocido a stats seguros. */
export function parseUserEngagementStats(raw: unknown): UserEngagementStats {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_USER_ENGAGEMENT_STATS };
  const o = raw as Record<string, unknown>;
  return {
    swipes: asNonNegInt(o.swipes),
    searches: asNonNegInt(o.searches),
    listingOpens: asNonNegInt(o.listingOpens),
    saves: asNonNegInt(o.saves),
  };
}

/** Por clave, toma el máximo (útil para fusionar local + servidor / dispositivos). */
export function mergeUserEngagementStats(
  a: UserEngagementStats,
  b: UserEngagementStats
): UserEngagementStats {
  return {
    swipes: Math.max(clampInt(a.swipes), clampInt(b.swipes)),
    searches: Math.max(clampInt(a.searches), clampInt(b.searches)),
    listingOpens: Math.max(clampInt(a.listingOpens), clampInt(b.listingOpens)),
    saves: Math.max(clampInt(a.saves), clampInt(b.saves)),
  };
}
