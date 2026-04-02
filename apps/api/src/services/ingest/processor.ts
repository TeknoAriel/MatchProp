import type { ListingSource } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { SourceConnector } from './types.js';
import { upsertListing } from './upsert.js';
import { markListingsInactiveNotInExternalIdSet } from './tombstone.js';

const EVENT_TYPE = 'INGEST_RUN_REQUESTED';
/** Tope por job (CLI puede pedir más; ingest:cron sigue usando 200 en su llamada). */
const INGEST_BATCH_MAX = 8000;
const TOUCH_UNCHANGED_CHUNK = 400;

type WatermarkMetadata = {
  etag?: string | null;
  accumulatedExternalIds?: string[];
};

function parseWatermarkMetadata(raw: unknown): WatermarkMetadata {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const etag = o.etag == null ? null : String(o.etag);
  const acc = o.accumulatedExternalIds;
  const accumulatedExternalIds = Array.isArray(acc)
    ? acc.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined;
  return { etag: etag || null, accumulatedExternalIds };
}

function sourceTimesUnchanged(
  prev: Date | null | undefined,
  next: Date | null | undefined
): boolean {
  if (prev == null || next == null) return false;
  return Math.floor(prev.getTime() / 1000) === Math.floor(next.getTime() / 1000);
}

export async function processIngestEvent(
  eventId: string,
  getConnector: (source: string) => SourceConnector | null
): Promise<{ processed: boolean; error?: string }> {
  const ev = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
  });
  if (!ev || ev.type !== EVENT_TYPE || ev.processedAt) {
    return { processed: false };
  }

  const payload = ev.payload as { source?: string; limit?: number; cursor?: string };
  const source = (payload?.source ?? 'KITEPROP_EXTERNALSITE') as ListingSource;
  const limit = Math.min(INGEST_BATCH_MAX, Math.max(1, payload?.limit ?? 200));
  const connector = getConnector(source);
  if (!connector) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: `Unknown source: ${source}` },
    });
    return { processed: true, error: `Unknown source: ${source}` };
  }

  let watermark = await prisma.syncWatermark.findUnique({
    where: { source },
  });
  if (!watermark) {
    watermark = await prisma.syncWatermark.create({
      data: { source, cursor: null, metadata: {} },
    });
  }

  const meta = parseWatermarkMetadata(watermark.metadata);
  const cursor = payload?.cursor ?? watermark.cursor;
  const ifNoneMatch = meta.etag?.trim() || null;

  const result = await connector.fetchBatch({
    cursor,
    limit,
    ifNoneMatch: ifNoneMatch || undefined,
  });

  if (result.feedUnchanged) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
    return { processed: true };
  }

  const atSyncStart = cursor == null || cursor === '';
  const accumulator: string[] =
    atSyncStart || result.catalogReset ? [] : [...(meta.accumulatedExternalIds ?? [])];

  const batchIds: string[] = [];
  const unchangedForTouch: string[] = [];
  const tombstoneSource = connector.fullCatalogTombstone === true;
  const externalIdsInBatch = result.items
    .map((raw) => String((raw as Record<string, unknown>).id ?? ''))
    .filter((id) => id.length > 0);

  const existingRows =
    tombstoneSource && externalIdsInBatch.length > 0
      ? await prisma.listing.findMany({
          where: { source, externalId: { in: externalIdsInBatch } },
          select: { externalId: true, updatedAtSource: true },
        })
      : [];
  const existingByExt = new Map(
    existingRows.map((r) => [r.externalId, r.updatedAtSource] as const)
  );

  for (const raw of result.items) {
    const norm = connector.normalize(raw);
    if (!norm.externalId) continue;
    batchIds.push(norm.externalId);

    if (tombstoneSource) {
      const prevUpdated = existingByExt.get(norm.externalId);
      if (sourceTimesUnchanged(prevUpdated, norm.updatedAtSource ?? null)) {
        unchangedForTouch.push(norm.externalId);
        continue;
      }
    }

    await upsertListing(norm, raw as Record<string, unknown>);
  }

  if (tombstoneSource && unchangedForTouch.length > 0) {
    const now = new Date();
    for (let i = 0; i < unchangedForTouch.length; i += TOUCH_UNCHANGED_CHUNK) {
      const chunk = unchangedForTouch.slice(i, i + TOUCH_UNCHANGED_CHUNK);
      await prisma.listing.updateMany({
        where: { source, externalId: { in: chunk } },
        data: { lastSeenAt: now, lastSyncedAt: now },
      });
    }
  }

  const nextAccumulator = [...new Set([...accumulator, ...batchIds])];

  const nextEtag = result.etag != null && result.etag !== '' ? result.etag : meta.etag ?? null;

  const syncComplete = result.nextCursor == null && connector.fullCatalogTombstone === true;

  if (syncComplete) {
    await markListingsInactiveNotInExternalIdSet(source, nextAccumulator);
  }

  const nextMetadata: WatermarkMetadata = {
    etag: nextEtag,
    accumulatedExternalIds:
      syncComplete && connector.fullCatalogTombstone ? [] : nextAccumulator,
  };

  await prisma.syncWatermark.update({
    where: { source },
    data: {
      cursor: result.nextCursor,
      metadata: nextMetadata as object,
    },
  });

  await prisma.outboxEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });

  return { processed: true };
}
