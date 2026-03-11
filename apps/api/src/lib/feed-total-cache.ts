/**
 * Cache in-memory para total del feed. TTL 30s, LRU con límite.
 * Key: userId + hash(filtros efectivos), sin cursor.
 */

const TTL_MS = 30_000;
// Escalabilidad: 100k+ usuarios. Configurable via FEED_CACHE_MAX_ENTRIES.
const DEFAULT_MAX_ENTRIES = Number(process.env.FEED_CACHE_MAX_ENTRIES) || 100_000;

type CacheEntry = { total: number; expiresAt: number; lastAccess: number };

export function normalizeFiltersForCache(f: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v)) {
      out[k] = [...v].sort();
    } else if (v === '') {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createFeedTotalCache(opts?: { maxEntries?: number }) {
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const cache = new Map<string, CacheEntry>();
  const accessOrder: string[] = [];

  function hashFilters(f: Record<string, unknown>): string {
    return JSON.stringify(normalizeFiltersForCache(f));
  }

  function evictIfNeeded(): void {
    if (cache.size < maxEntries) return;
    const now = Date.now();
    const expired = [...cache.entries()].filter(([, e]) => now > e.expiresAt);
    for (const [k] of expired) {
      cache.delete(k);
      const idx = accessOrder.indexOf(k);
      if (idx >= 0) accessOrder.splice(idx, 1);
    }
    while (cache.size >= maxEntries && accessOrder.length > 0) {
      const oldest = accessOrder.shift()!;
      cache.delete(oldest);
    }
  }

  function getCachedTotal(userId: string, filters: Record<string, unknown>): number | null {
    const key = `${userId}:${hashFilters(filters)}`;
    const entry = cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) cache.delete(key);
      return null;
    }
    entry.lastAccess = Date.now();
    const idx = accessOrder.indexOf(key);
    if (idx >= 0) accessOrder.splice(idx, 1);
    accessOrder.push(key);
    return entry.total;
  }

  function setCachedTotal(userId: string, filters: Record<string, unknown>, total: number): void {
    evictIfNeeded();
    const key = `${userId}:${hashFilters(filters)}`;
    const now = Date.now();
    cache.set(key, { total, expiresAt: now + TTL_MS, lastAccess: now });
    const idx = accessOrder.indexOf(key);
    if (idx >= 0) accessOrder.splice(idx, 1);
    accessOrder.push(key);
  }

  return { getCachedTotal, setCachedTotal };
}

const defaultCache = createFeedTotalCache();
export const getCachedTotal = defaultCache.getCachedTotal;
export const setCachedTotal = defaultCache.setCachedTotal;
