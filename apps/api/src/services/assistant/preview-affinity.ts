import { prisma } from '../../lib/prisma.js';

export type WithPropertyType = { id: string; propertyType?: string | null };

/** Peso relativo: favorito es señal más fuerte que un like en Match. */
const WEIGHT_FAVORITE = 2;
const WEIGHT_SWIPE_LIKE = 1;

/**
 * Reordena resultados del asistente priorizando tipos de propiedad según
 * favoritos y likes en Match (sin ML; señal agregada).
 */
export async function reorderByEngagementAffinity<T extends WithPropertyType>(
  userId: string,
  items: T[]
): Promise<T[]> {
  if (items.length <= 1) return items;
  const weights = await engagementPropertyTypeWeights(userId);
  if (weights.size === 0) return items;
  const score = (pt: string | null | undefined) => (pt ? (weights.get(pt) ?? 0) : 0);
  return [...items].sort((a, b) => score(b.propertyType) - score(a.propertyType));
}

async function engagementPropertyTypeWeights(userId: string): Promise<Map<string, number>> {
  const [favRows, likeRows] = await Promise.all([
    prisma.savedItem.findMany({
      where: { userId, listType: 'FAVORITE' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { listing: { select: { propertyType: true } } },
    }),
    prisma.swipeDecision.findMany({
      where: { userId, decision: 'LIKE' },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: { listing: { select: { propertyType: true } } },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const r of favRows) {
    const pt = r.listing.propertyType;
    if (!pt) continue;
    counts.set(pt, (counts.get(pt) ?? 0) + WEIGHT_FAVORITE);
  }
  for (const r of likeRows) {
    const pt = r.listing.propertyType;
    if (!pt) continue;
    counts.set(pt, (counts.get(pt) ?? 0) + WEIGHT_SWIPE_LIKE);
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return new Map();
  const w = new Map<string, number>();
  for (const [k, v] of counts) {
    w.set(k, v / total);
  }
  return w;
}

/** Alias histórico (misma implementación que engagement). */
export const reorderByFavoriteAffinity = reorderByEngagementAffinity;
