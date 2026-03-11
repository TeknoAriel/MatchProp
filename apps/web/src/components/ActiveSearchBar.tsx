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
      <div className="sticky top-0 z-10 bg-[var(--mp-card)] border-b border-[var(--mp-border)] px-3 py-2 text-sm text-[var(--mp-muted)]">
        Cargando búsqueda activa...
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-[var(--mp-card)] border-b border-[var(--mp-border)] shadow-sm">
      {!search ? (
        <div className="px-3 py-3 sm:px-4 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[var(--mp-muted)] text-sm shrink-0">Sin búsqueda activa</span>
              <Link
                href="/assistant"
                className="px-4 py-2 rounded-xl text-sm font-semibold btn-accent shadow-sm hover:shadow transition-shadow"
              >
                Crear búsqueda
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/feed"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
              >
                Ver Match
              </Link>
              <Link
                href="/feed/list"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
              >
                Ver lista
              </Link>
              <Link
                href="/feed?feed=all"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] transition-colors"
              >
                Ver todo
              </Link>
              <Link
                href="/alerts"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] transition-colors"
              >
                Alertas
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 sm:px-4 sm:py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span
                className="font-semibold text-[var(--mp-foreground)] truncate max-w-[160px] sm:max-w-[220px]"
                title={search.name}
              >
                {search.name}
              </span>
              <span
                className="text-[var(--mp-muted)] text-sm truncate max-w-[140px] sm:max-w-[200px] min-w-0"
                title={filtersToHumanSummary(search.filters)}
              >
                {filtersToHumanSummary(search.filters)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/feed"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold btn-accent shadow-sm"
              >
                Match
              </Link>
              <Link
                href="/feed/list"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
              >
                Lista
              </Link>
              <Link
                href={`/searches/${search.id}`}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
              >
                Alertas
              </Link>
              <Link
                href="/assistant"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] transition-colors"
              >
                Cambiar
              </Link>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                {clearing ? '...' : 'Limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
