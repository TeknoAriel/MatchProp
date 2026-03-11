/**
 * Sprint 11: computa matches para un listing y persiste (ListingMatchCandidate + CrmPushOutbox + MatchEvent).
 * Reverse-matching: matchea contra búsquedas ACTIVAS (SavedSearch con activeSearchId en User).
 * Usado por on-listing-created y demo backfill.
 */
import { prisma } from '../../lib/prisma.js';
import { listingMatchesFilters } from '../../lib/feed-engine.js';
import { enqueueCrmPush } from './enqueue.js';

const MAX_SEARCHES = 500;
const MAX_TOP_IDS = 10;

export type RecordMatchesOptions = {
  source?: 'DEMO' | 'CRM_WEBHOOK';
  /** Solo búsquedas activas (User.activeSearchId = savedSearchId). Default true. */
  onlyActiveSearches?: boolean;
  /** Encolar push a CRM (solo si source CRM/integración). Default false. */
  enqueueCrm?: boolean;
};

export async function recordMatchesForListing(
  listingId: string,
  source: 'DEMO' | 'CRM_WEBHOOK' = 'DEMO',
  opts: RecordMatchesOptions = {}
): Promise<{ matchesCount: number; topSearchIds: string[] }> {
  const { onlyActiveSearches = true, enqueueCrm = false } =
    typeof opts === 'object' && opts !== null ? opts : {};
  const src = opts?.source ?? source;

  const searches = await prisma.savedSearch.findMany({
    where: onlyActiveSearches ? { usersWithActive: { some: {} } } : undefined,
    take: MAX_SEARCHES,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, filtersJson: true },
  });

  const topSearchIds: string[] = [];
  const matchedSearchIds: string[] = [];
  for (const s of searches) {
    const filters = (s.filtersJson ?? {}) as Record<string, unknown>;
    if (!filters || typeof filters !== 'object') continue;
    try {
      const matches = await listingMatchesFilters(listingId, filters);
      if (matches) {
        matchedSearchIds.push(s.id);
        if (topSearchIds.length < MAX_TOP_IDS) topSearchIds.push(s.id);
      }
    } catch {
      // skip
    }
  }

  const matchesCount = matchedSearchIds.length;

  // Persistir ListingMatchCandidate (dedupe por unique)
  if (matchesCount > 0) {
    await prisma.$transaction(async (tx) => {
      for (const savedSearchId of matchedSearchIds) {
        await tx.listingMatchCandidate.upsert({
          where: {
            listingId_savedSearchId: { listingId, savedSearchId },
          },
          create: { listingId, savedSearchId, score: 1 },
          update: { score: 1 },
        });
      }
    });

    await prisma.matchEvent.create({
      data: { listingId, matchesCount, source: src },
    });
  }

  if (enqueueCrm) {
    await enqueueCrmPush(listingId, matchesCount, topSearchIds);
  }

  return { matchesCount, topSearchIds };
}
