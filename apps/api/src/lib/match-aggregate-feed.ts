/**
 * Feed agregado "Mis match" (SPEC): uniona resultados de todas las búsquedas guardadas
 * y ordena like (LATER) > favorito > resto, luego por recencia.
 */
import type { SearchFilters } from '@matchprop/shared';
import { prisma } from './prisma.js';
import { executeFeed } from './feed-engine.js';

const DEFAULT_MAX_SEARCHES = 12;
const DEFAULT_PER_SEARCH = 24;
const DEFAULT_MAX_LISTINGS = 60;
const ABS_MAX_LISTINGS = 100;

type ExecuteFeedResult = Awaited<ReturnType<typeof executeFeed>>;
type FeedItem = Extract<ExecuteFeedResult, { items: unknown[] }>['items'][number];

function tierFor(
  flags: { like: boolean; favorite: boolean }
): 0 | 1 | 2 {
  if (flags.like) return 0;
  if (flags.favorite) return 1;
  return 2;
}

/**
 * Lista de cards de listing para el usuario, agregando sus SavedSearch.
 */
export async function getAggregatedMatchFeed(
  userId: string,
  opts?: {
    maxSearches?: number;
    perSearchLimit?: number;
    maxListings?: number;
  }
): Promise<FeedItem[]> {
  const maxSearches = opts?.maxSearches ?? DEFAULT_MAX_SEARCHES;
  const perSearchLimit = opts?.perSearchLimit ?? DEFAULT_PER_SEARCH;
  const maxListings = Math.min(
    Math.max(1, opts?.maxListings ?? DEFAULT_MAX_LISTINGS),
    ABS_MAX_LISTINGS
  );

  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: maxSearches,
    select: { id: true, filtersJson: true },
  });

  if (searches.length === 0) return [];

  const byId = new Map<string, FeedItem>();

  for (const sub of searches) {
    if (byId.size >= maxListings) break;

    const rawFilters = (sub.filtersJson ?? {}) as SearchFilters;
    const filters = { ...rawFilters };
    delete (filters as { sortBy?: unknown }).sortBy;

    const result = await executeFeed({
      userId,
      limit: perSearchLimit,
      includeTotal: false,
      filters,
      excludeSwipes: true,
    });

    if (result.error || !result.items?.length) continue;

    for (const item of result.items) {
      const id = (item as { id: string }).id;
      if (!id || byId.has(id)) continue;
      byId.set(id, item as FeedItem);
      if (byId.size >= maxListings) break;
    }
  }

  if (byId.size === 0) return [];

  const ids = [...byId.keys()];

  const [metaRows, savedRows] = await Promise.all([
    prisma.listing.findMany({
      where: { id: { in: ids } },
      select: { id: true, lastSeenAt: true, createdAt: true },
    }),
    prisma.savedItem.findMany({
      where: { userId, listingId: { in: ids } },
      select: { listingId: true, listType: true },
    }),
  ]);

  const tsById = new Map<string, number>();
  for (const m of metaRows) {
    const t1 = m.lastSeenAt?.getTime() ?? 0;
    const t2 = m.createdAt.getTime();
    tsById.set(m.id, Math.max(t1, t2));
  }

  const flagsById = new Map<string, { like: boolean; favorite: boolean }>();
  for (const id of ids) flagsById.set(id, { like: false, favorite: false });
  for (const s of savedRows) {
    const f = flagsById.get(s.listingId);
    if (!f) continue;
    if (s.listType === 'LATER') f.like = true;
    if (s.listType === 'FAVORITE') f.favorite = true;
  }

  const sortedIds = [...ids].sort((a, b) => {
    const fa = flagsById.get(a) ?? { like: false, favorite: false };
    const fb = flagsById.get(b) ?? { like: false, favorite: false };
    const ta = tierFor(fa);
    const tb = tierFor(fb);
    if (ta !== tb) return ta - tb;
    return (tsById.get(b) ?? 0) - (tsById.get(a) ?? 0);
  });

  return sortedIds.map((id) => byId.get(id)!);
}
