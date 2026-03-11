/**
 * Sprint 11: hook al crear listing. Reverse-matching universal.
 * - Cualquier listing ACTIVE: computa matches vs búsquedas activas, persiste ListingMatchCandidate, crea MatchEvent.
 * - Solo si source === CRM_WEBHOOK: encola CrmPushOutbox para push a CRM.
 */
import type { ListingSource } from '@prisma/client';
import { recordMatchesForListing } from './record-matches.js';

/** Llamar cuando se crea un listing nuevo. Reverse-matching universal; enqueue CRM solo si source CRM. */
export async function onListingCreated(
  listingId: string,
  source: ListingSource,
  status: 'ACTIVE' | 'INACTIVE'
): Promise<void> {
  if (status !== 'ACTIVE') return;

  const isCrmSource = source === 'CRM_WEBHOOK';
  await recordMatchesForListing(listingId, isCrmSource ? 'CRM_WEBHOOK' : 'DEMO', {
    onlyActiveSearches: true,
    enqueueCrm: isCrmSource,
  });
}
