/**
 * Lógica del job de alertas. Exportada para tests.
 * Una sola pasada, sin intervals/workers. Entrypoint productivo y tests llaman runAlerts(opts).
 */
import { prisma } from './prisma.js';
import { executeFeed, listingMatchesFilters } from './feed-engine.js';
import type { SearchFilters } from '@matchprop/shared';

export type RunAlertsOptions = {
  /** Límite de items por subscription para NEW_LISTING (default 100). En tests usar valor bajo. */
  feedLimit?: number;
  /** Fecha “ahora” para determinismo en tests. */
  now?: Date;
  /** Logger; en tests pasar noop para evitar output. */
  logger?: (msg: string) => void;
};

const DEFAULT_FEED_LIMIT = 100;

function safeCreateDelivery(
  subscriptionId: string,
  listingId: string,
  type: 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET'
): Promise<void> {
  return prisma.alertDelivery
    .create({
      data: { subscriptionId, listingId, type },
    })
    .then(() => {})
    .catch((err) => {
      if (err?.code === 'P2002') return; // Unique constraint
      throw err;
    });
}

/**
 * Ejecuta una pasada del job de alertas. Sin colas ni timers.
 * En tests: pasar feedLimit bajo y logger noop para ser rápido y determinista.
 */
export async function runAlerts(opts: RunAlertsOptions = {}): Promise<void> {
  const now = opts.now ?? new Date();
  const feedLimit = opts.feedLimit ?? DEFAULT_FEED_LIMIT;
  const log = opts.logger ?? ((msg: string) => console.log(msg));

  const subs = await prisma.alertSubscription.findMany({
    where: { isEnabled: true },
    include: { savedSearch: true },
  });

  for (const sub of subs) {
    const filters = (sub.filtersJson ?? sub.savedSearch?.filtersJson ?? {}) as SearchFilters;
    if (!filters || typeof filters !== 'object') {
      await prisma.alertSubscription.update({
        where: { id: sub.id },
        data: { lastRunAt: now },
      });
      continue;
    }

    const lastRun = sub.lastRunAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (sub.type === 'NEW_LISTING') {
      const result = await executeFeed({
        userId: sub.userId,
        limit: feedLimit,
        includeTotal: false,
        filters,
        excludeSwipes: false,
        since: lastRun,
      });

      if (result.error || !result.items?.length) {
        await prisma.alertSubscription.update({
          where: { id: sub.id },
          data: { lastRunAt: now },
        });
        continue;
      }

      for (const item of result.items) {
        const listingId = (item as { id: string }).id;
        await safeCreateDelivery(sub.id, listingId, 'NEW_LISTING');
        const title = (item as { title?: string }).title ?? 'Sin título';
        log(
          `[Alert] userId=${sub.userId} sub=${sub.id} NEW_LISTING listing=${listingId} "${title}"`
        );
      }
    } else if (sub.type === 'PRICE_DROP') {
      const events = await prisma.listingEvent.findMany({
        where: {
          type: 'PRICE_CHANGED',
          createdAt: { gte: lastRun },
        },
        include: { listing: true },
      });

      for (const ev of events) {
        const payload = ev.payload as {
          oldPrice?: number;
          newPrice?: number;
          oldCurrency?: string | null;
          newCurrency?: string | null;
        };
        if (
          typeof payload.oldPrice !== 'number' ||
          typeof payload.newPrice !== 'number' ||
          payload.newPrice >= payload.oldPrice
        ) {
          continue;
        }
        const oldCur = payload.oldCurrency ?? null;
        const newCur = payload.newCurrency ?? null;
        if (oldCur !== newCur) continue;

        const matches = await listingMatchesFilters(ev.listingId, filters);
        if (!matches) continue;

        await safeCreateDelivery(sub.id, ev.listingId, 'PRICE_DROP');
        const title = ev.listing.title ?? 'Sin título';
        log(
          `[Alert] userId=${sub.userId} sub=${sub.id} PRICE_DROP listing=${ev.listingId} "${title}"`
        );
      }
    } else if (sub.type === 'BACK_ON_MARKET') {
      const events = await prisma.listingEvent.findMany({
        where: {
          type: 'STATUS_CHANGED',
          createdAt: { gte: lastRun },
        },
        include: { listing: true },
      });

      for (const ev of events) {
        const payload = ev.payload as { oldStatus?: string; newStatus?: string };
        if (payload.oldStatus !== 'INACTIVE' || payload.newStatus !== 'ACTIVE') continue;

        const matches = await listingMatchesFilters(ev.listingId, filters);
        if (!matches) continue;

        await safeCreateDelivery(sub.id, ev.listingId, 'BACK_ON_MARKET');
        const title = ev.listing.title ?? 'Sin título';
        log(
          `[Alert] userId=${sub.userId} sub=${sub.id} BACK_ON_MARKET listing=${ev.listingId} "${title}"`
        );
      }
    }

    await prisma.alertSubscription.update({
      where: { id: sub.id },
      data: { lastRunAt: now },
    });
  }
}
