/**
 * Sprint 10: encolar notificación listing.matches_found para push a CRM.
 */
import { prisma } from '../../lib/prisma.js';

export async function enqueueCrmPush(
  listingId: string,
  matchesCount: number,
  topSearchIds: string[] = []
): Promise<string> {
  const row = await prisma.crmPushOutbox.create({
    data: {
      listingId,
      matchesCount,
      topSearchIds: topSearchIds.length ? topSearchIds : undefined,
      status: 'PENDING',
      attempts: 0,
    },
  });
  return row.id;
}
