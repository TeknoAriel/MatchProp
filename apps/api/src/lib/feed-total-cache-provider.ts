/**
 * Punto único de entrada para caché de totales del feed.
 * - Sin REDIS_URL: LRU en memoria (createFeedTotalCache).
 * - Con REDIS_URL: Redis (ioredis), carga el módulo solo si hace falta.
 */
import { createFeedTotalCache } from './feed-total-cache.js';

export type FeedTotalCachePort = {
  getCachedTotal(userId: string, filters: Record<string, unknown>): Promise<number | null>;
  setCachedTotal(userId: string, filters: Record<string, unknown>, total: number): Promise<void>;
};

let impl: FeedTotalCachePort | null = null;

async function getImpl(): Promise<FeedTotalCachePort> {
  if (impl) return impl;
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    const { createRedisFeedTotalCache } = await import('./feed-total-cache-redis.js');
    impl = createRedisFeedTotalCache(redisUrl);
  } else {
    impl = createFeedTotalCache();
  }
  return impl;
}

export async function getCachedTotal(
  userId: string,
  filters: Record<string, unknown>
): Promise<number | null> {
  return (await getImpl()).getCachedTotal(userId, filters);
}

export async function setCachedTotal(
  userId: string,
  filters: Record<string, unknown>,
  total: number
): Promise<void> {
  return (await getImpl()).setCachedTotal(userId, filters, total);
}
