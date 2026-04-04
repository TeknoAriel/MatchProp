import type { ListingSource } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const CHUNK = 400;

/**
 * Marca INACTIVE los listings de `source` que están ACTIVE y cuyo externalId
 * no está en `activeExternalIds` (no aparecen en el JSON del sync actual).
 */
export async function markListingsInactiveNotInExternalIdSet(
  source: ListingSource,
  activeExternalIds: string[]
): Promise<number> {
  const now = new Date();
  const keep = new Set(activeExternalIds.filter((id) => id && id.length > 0));

  if (keep.size === 0) {
    const r = await prisma.listing.updateMany({
      where: { source, status: 'ACTIVE' },
      data: { status: 'INACTIVE', lastSyncedAt: now },
    });
    return r.count;
  }

  const activeRows = await prisma.listing.findMany({
    where: { source, status: 'ACTIVE' },
    select: { id: true, externalId: true },
  });
  const toOff = activeRows.filter((row) => !keep.has(row.externalId));
  let total = 0;
  for (let i = 0; i < toOff.length; i += CHUNK) {
    const ids = toOff.slice(i, i + CHUNK).map((row) => row.id);
    const r = await prisma.listing.updateMany({
      where: { id: { in: ids } },
      data: { status: 'INACTIVE', lastSyncedAt: now },
    });
    total += r.count;
  }
  return total;
}
