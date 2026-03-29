'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getUserLevel,
  totalEngagementInteractions,
  type UserEngagementStats,
  type UserLevel,
} from '@matchprop/shared';
import {
  getEngagementFromStorage,
  hydrateEngagementFromServer,
  recordEngagement,
  USER_ENGAGEMENT_CHANGED_EVENT,
  type EngagementKind,
} from '../lib/userEngagementClient';

export type UserLevelContextValue = {
  level: UserLevel;
  stats: UserEngagementStats;
  totalInteractions: number;
  recordInteraction: (kind: EngagementKind, delta?: number) => void;
  recordSwipe: () => void;
  recordSearch: () => void;
  recordListingOpen: () => void;
  recordSave: () => void;
};

const UserLevelContext = createContext<UserLevelContextValue | null>(null);

export function UserEngagementProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<UserEngagementStats>(() => getEngagementFromStorage());

  useEffect(() => {
    const refresh = () => setStats(getEngagementFromStorage());
    window.addEventListener(USER_ENGAGEMENT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    void hydrateEngagementFromServer().then(refresh);
    return () => {
      window.removeEventListener(USER_ENGAGEMENT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const recordInteraction = useCallback((kind: EngagementKind, delta = 1) => {
    recordEngagement(kind, delta);
  }, []);

  const recordSwipe = useCallback(() => recordInteraction('swipe'), [recordInteraction]);
  const recordSearch = useCallback(() => recordInteraction('search'), [recordInteraction]);
  const recordListingOpen = useCallback(
    () => recordInteraction('listingOpen'),
    [recordInteraction]
  );
  const recordSave = useCallback(() => recordInteraction('save'), [recordInteraction]);

  const value = useMemo<UserLevelContextValue>(() => {
    const level = getUserLevel(stats);
    const totalInteractions = totalEngagementInteractions(stats);
    return {
      level,
      stats,
      totalInteractions,
      recordInteraction,
      recordSwipe,
      recordSearch,
      recordListingOpen,
      recordSave,
    };
  }, [stats, recordInteraction, recordSwipe, recordSearch, recordListingOpen, recordSave]);

  return <UserLevelContext.Provider value={value}>{children}</UserLevelContext.Provider>;
}

export function useUserLevel(): UserLevelContextValue {
  const ctx = useContext(UserLevelContext);
  if (!ctx) {
    throw new Error('useUserLevel debe usarse dentro de UserEngagementProvider');
  }
  return ctx;
}
