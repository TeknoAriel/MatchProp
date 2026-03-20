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
            href="/assistant"
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--mp-bg)] border border-[var(--mp-border)] hover:border-[var(--mp-accent)]/40 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--mp-muted)] shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="text-sm text-[var(--mp-muted)]">Buscar propiedades…</span>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium text-[var(--mp-foreground)] truncate"
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
            <nav className="flex items-center gap-1 shrink-0">
              <Link
                href="/feed"
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--mp-accent)] text-white"
              >
                Match
              </Link>
              <Link
                href="/feed/list"
                className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--mp-foreground)] bg-[var(--mp-bg)] border border-[var(--mp-border)]"
              >
                Lista
              </Link>
              <Link
                href="/alerts"
                className="px-2 py-1.5 rounded-full text-xs font-medium text-[var(--mp-foreground)] bg-[var(--mp-bg)] border border-[var(--mp-border)]"
                title="Alertas de esta búsqueda"
              >
                Alertas
              </Link>
              <Link
                href="/assistant"
                className="px-2 py-1.5 rounded-full text-xs text-[var(--mp-muted)] hover:text-[var(--mp-foreground)]"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="px-2 py-1.5 text-xs text-[var(--mp-muted)] hover:text-red-500 rounded-full transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
