/**
 * Sprint 10: una pasada del worker de push a CRM.
 * Procesa CrmPushOutbox PENDING con nextAttemptAt <= now (o null).
 */
import { prisma } from '../../lib/prisma.js';
import { CrmPushStatus } from '@prisma/client';
import { sendToCrmWebhook } from './sender.js';

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000]; // 1m, 5m, 15m, 1h, 6h

export type RunCrmPushResult = {
  processed: number;
  sent: number;
  failed: number;
  sentIds: string[];
  failedIds: string[];
  failedReasons: string[];
};

export async function runCrmPushOnce(): Promise<RunCrmPushResult> {
  const now = new Date();
  const pending = await prisma.crmPushOutbox.findMany({
    where: {
      status: CrmPushStatus.PENDING,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });

  const sentIds: string[] = [];
  const failedIds: string[] = [];
  const failedReasons: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const payload = {
      event: 'listing.matches_found' as const,
      listingId: row.listingId,
      matchesCount: row.matchesCount,
      topSearchIds: (row.topSearchIds as string[]) ?? [],
      createdAt: row.createdAt.toISOString(),
    };

    const result = await sendToCrmWebhook(payload);
    const nextAttempt = row.attempts + 1;

    if (result.ok) {
      await prisma.crmPushOutbox.update({
        where: { id: row.id },
        data: { status: CrmPushStatus.SENT, attempts: nextAttempt },
      });
      sent++;
      if (sentIds.length < 10) sentIds.push(row.id);
    } else {
      const isLast = nextAttempt >= MAX_ATTEMPTS;
      const backoffIdx = Math.min(nextAttempt - 1, BACKOFF_MS.length - 1);
      const delayMs = BACKOFF_MS[backoffIdx] ?? 60_000;
      const nextAt = isLast ? null : new Date(Date.now() + delayMs);
      await prisma.crmPushOutbox.update({
        where: { id: row.id },
        data: {
          status: isLast ? CrmPushStatus.FAILED : CrmPushStatus.PENDING,
          attempts: nextAttempt,
          nextAttemptAt: nextAt,
          lastError: (result.error ?? `HTTP ${result.status ?? 0}`).slice(0, 1000),
        },
      });
      failed++;
      if (failedIds.length < 10) {
        failedIds.push(row.id);
        failedReasons.push((result.error ?? `HTTP ${result.status ?? 0}`).slice(0, 80));
      }
    }
  }

  return {
    processed: pending.length,
    sent,
    failed,
    sentIds,
    failedIds,
    failedReasons,
  };
}
