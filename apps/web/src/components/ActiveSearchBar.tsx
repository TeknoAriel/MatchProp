'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { filtersToHumanSummary } from '../lib/filters-summary';
import type { SearchFilters } from '@matchprop/shared';

const API_BASE = '/api';

type ActiveSearch = {
  id: string;
  name: string;
  queryText: string | null;
  filters: SearchFilters;
  updatedAt: string;
} | null;

export default function ActiveSearchBar() {
  const [search, setSearch] = useState<ActiveSearch>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search: ActiveSearch }) => setSearch(data.search))
      .catch(() => setSearch(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId: null }),
      });
      if (res.ok) setSearch(null);
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <div className="sticky top-0 z-10 bg-[var(--mp-card)] border-b border-[var(--mp-border)]">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-2.5 h-10 bg-[var(--mp-bg)] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-[var(--mp-card)]/95 backdrop-blur border-b border-[var(--mp-border)]">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-2.5">
        {!search ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)] hover:border-[var(--mp-accent)]/35 transition-colors"
          >
            <span className="text-base shrink-0" aria-hidden>
              👉
            </span>
            <span className="text-sm text-[var(--mp-foreground)] font-medium truncate">
              Qué estás buscando
            </span>
            <span className="text-xs text-[var(--mp-accent)] font-semibold shrink-0 ml-auto">
              Definir
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-h-[44px]">
            <span className="text-base shrink-0" aria-hidden>
              👉
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--mp-muted)] uppercase tracking-wide">
                Qué estás buscando
              </p>
              <p
                className="text-sm font-semibold text-[var(--mp-foreground)] truncate"
                title={search.name}
              >
                {search.name}
              </p>
              <p
                className="text-xs text-[var(--mp-muted)] truncate"
                title={filtersToHumanSummary(search.filters)}
              >
                {filtersToHumanSummary(search.filters)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href="/dashboard"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--mp-accent)] hover:bg-[color-mix(in_srgb,var(--mp-accent)_10%,transparent)]"
              >
                Cambiar
              </Link>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="px-2 py-1.5 text-xs text-[var(--mp-muted)] hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                title="Quitar búsqueda activa"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
