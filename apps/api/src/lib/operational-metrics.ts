import { prisma } from './prisma.js';

/** Mismos campos que expone `GET /health` en `ops` (DB debe estar accesible). */
export type OperationalMetrics = {
  outboxIngestPending: number | null;
  cronIngestLastAt: string | null;
  crmPushPending: number | null;
  crmPushFailed: number | null;
};

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  const out: OperationalMetrics = {
    outboxIngestPending: null,
    cronIngestLastAt: null,
    crmPushPending: null,
    crmPushFailed: null,
  };

  try {
    out.outboxIngestPending = await prisma.outboxEvent.count({
      where: { type: 'INGEST_RUN_REQUESTED', processedAt: null },
    });
  } catch {
    /* ignore */
  }

  try {
    const lastCron = await prisma.outboxEvent.findFirst({
      where: { type: 'CRON_INGEST_COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    out.cronIngestLastAt = lastCron?.createdAt?.toISOString() ?? null;
  } catch {
    /* ignore */
  }

  try {
    const [pending, failed] = await Promise.all([
      prisma.crmPushOutbox.count({ where: { status: 'PENDING' } }),
      prisma.crmPushOutbox.count({ where: { status: 'FAILED' } }),
    ]);
    out.crmPushPending = pending;
    out.crmPushFailed = failed;
  } catch {
    /* ignore */
  }

  return out;
}
