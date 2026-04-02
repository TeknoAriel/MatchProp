/**
 * Caché distribuida del total del feed (TTL 30s) vía Redis.
 * Usar con varias réplicas de API o para alinear totales entre instancias.
 */
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { normalizeFiltersForCache } from './feed-total-cache.js';

const TTL_SEC = 30;

function cacheKey(userId: string, filters: Record<string, unknown>): string {
  const h = createHash('sha256')
    .update(JSON.stringify(normalizeFiltersForCache(filters)))
    .digest('hex');
  return `mp:feed:total:${userId}:${h}`;
}

export type RedisFeedTotalCache = {
  getCachedTotal(userId: string, filters: Record<string, unknown>): Promise<number | null>;
  setCachedTotal(userId: string, filters: Record<string, unknown>, total: number): Promise<void>;
};

export function createRedisFeedTotalCache(redisUrl: string): RedisFeedTotalCache {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  return {
    async getCachedTotal(userId: string, filters: Record<string, unknown>): Promise<number | null> {
      try {
        const v = await client.get(cacheKey(userId, filters));
        if (v == null) return null;
        const n = Number.parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    },

    async setCachedTotal(
      userId: string,
      filters: Record<string, unknown>,
      total: number
    ): Promise<void> {
      try {
        await client.set(cacheKey(userId, filters), String(total), 'EX', TTL_SEC);
      } catch {
        /* no bloquear el feed si Redis falla */
      }
    },
  };
}
