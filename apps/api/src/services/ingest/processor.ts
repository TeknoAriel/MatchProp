import { prisma } from '../../lib/prisma.js';
import type { SourceConnector } from './types.js';
import { upsertListing } from './upsert.js';

const EVENT_TYPE = 'INGEST_RUN_REQUESTED';

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
  const source = payload?.source ?? 'KITEPROP_EXTERNALSITE';
  const limit = Math.min(200, Math.max(1, payload?.limit ?? 200));
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
      data: { source, cursor: null },
    });
  }

  const cursor = payload?.cursor ?? watermark.cursor;
  const { items, nextCursor } = await connector.fetchBatch({ cursor, limit });

  for (const raw of items) {
    const norm = connector.normalize(raw);
    await upsertListing(norm, raw as Record<string, unknown>);
  }

  await prisma.syncWatermark.update({
    where: { source },
    data: { cursor: nextCursor },
  });

  await prisma.outboxEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });

  return { processed: true };
}
