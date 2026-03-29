import {
  EMPTY_USER_ENGAGEMENT_STATS,
  mergeUserEngagementStats,
  parseUserEngagementStats,
  type UserEngagementStats,
} from '@matchprop/shared';

export const USER_ENGAGEMENT_STORAGE_KEY = 'matchprop_user_engagement_v1';

/** Evento mismo-tab; `storage` solo cruza tabs. */
export const USER_ENGAGEMENT_CHANGED_EVENT = 'matchprop:user-engagement-changed';

export type EngagementKind = 'swipe' | 'search' | 'listingOpen' | 'save';

const KIND_TO_FIELD: Record<EngagementKind, keyof UserEngagementStats> = {
  swipe: 'swipes',
  search: 'searches',
  listingOpen: 'listingOpens',
  save: 'saves',
};

function readLocal(): UserEngagementStats {
  if (typeof window === 'undefined') return { ...EMPTY_USER_ENGAGEMENT_STATS };
  try {
    const raw = window.localStorage.getItem(USER_ENGAGEMENT_STORAGE_KEY);
    if (!raw) return { ...EMPTY_USER_ENGAGEMENT_STATS };
    return parseUserEngagementStats(JSON.parse(raw));
  } catch {
    return { ...EMPTY_USER_ENGAGEMENT_STATS };
  }
}

function writeLocal(stats: UserEngagementStats) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = parseUserEngagementStats(stats);
    window.localStorage.setItem(USER_ENGAGEMENT_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent(USER_ENGAGEMENT_CHANGED_EVENT, { detail: normalized })
    );
  } catch {
    /* quota / private mode */
  }
}

/** Lectura actual (útil para hidratar estado sin hook). */
export function getEngagementFromStorage(): UserEngagementStats {
  return readLocal();
}

export function replaceEngagementStats(next: UserEngagementStats) {
  writeLocal(parseUserEngagementStats(next));
}

/** Fusiona con snapshot del servidor (máximo por campo) y persiste. */
export function mergeEngagementFromServerPayload(server: unknown): UserEngagementStats {
  const parsed = parseUserEngagementStats(server);
  const merged = mergeUserEngagementStats(readLocal(), parsed);
  writeLocal(merged);
  return merged;
}

export function recordEngagement(kind: EngagementKind, delta = 1) {
  const d = Math.max(1, Math.floor(delta));
  const cur = readLocal();
  const field = KIND_TO_FIELD[kind];
  const next: UserEngagementStats = { ...cur, [field]: cur[field] + d };
  writeLocal(parseUserEngagementStats(next));
  scheduleEngagementSyncToServer();
}

const SESSION_LISTING_PREFIX = 'matchprop_listing_open_';

/** Una apertura contada por ficha y sesión de pestaña (evita doble conteo en remounts). */
export function recordListingOpenSessionOnce(listingId: string) {
  if (typeof window === 'undefined' || !listingId) return;
  const k = `${SESSION_LISTING_PREFIX}${listingId}`;
  try {
    if (window.sessionStorage.getItem(k)) return;
    window.sessionStorage.setItem(k, '1');
  } catch {
    /* sessionStorage blocked */
  }
  recordEngagement('listingOpen');
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleEngagementSyncToServer() {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushEngagementToServer();
  }, 2000);
}

async function pushEngagementToServer() {
  const stats = readLocal();
  try {
    const res = await fetch('/api/preferences/engagement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(stats),
    });
    if (res.status === 401) return;
    if (!res.ok) return;
    const data: unknown = await res.json();
    mergeEngagementFromServerPayload(data);
  } catch {
    /* offline */
  }
}

/** Tras login: mezcla stats del servidor con local. */
export async function hydrateEngagementFromServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/preferences', { credentials: 'include' });
    if (res.status === 401) return;
    if (!res.ok) return;
    const pref: { engagementStats?: unknown } | null = await res.json();
    if (pref?.engagementStats != null) {
      mergeEngagementFromServerPayload(pref.engagementStats);
    }
  } catch {
    /* ignore */
  }
}
