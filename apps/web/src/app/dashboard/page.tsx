'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import { filtersToHumanSummary } from '../../lib/filters-summary';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

/**
 * Dashboard: cargar búsqueda → Match por defecto + botón Ver en lista.
 * - Si hay búsqueda activa: redirige a /feed (Match).
 * - Si no: muestra listado de búsquedas guardadas para cargar una.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/me/active-search`, { credentials: 'include' }),
      fetch(`${API_BASE}/searches`, { credentials: 'include' }),
    ])
      .then(async ([activeRes, searchesRes]) => {
        if (activeRes.status === 401 || searchesRes.status === 401) {
          router.replace('/login');
          return;
        }
        let activeData: { search?: unknown } | null = null;
        let searchesData: SavedSearchDTO[] = [];
        try {
          activeData = activeRes.ok ? await activeRes.json() : null;
        } catch {
          activeData = null;
        }
        try {
          const raw = searchesRes.ok ? await searchesRes.json() : null;
          searchesData = Array.isArray(raw) ? raw : (raw?.searches && Array.isArray(raw.searches) ? raw.searches : []);
        } catch {
          searchesData = [];
        }
        if (activeData?.search) {
          router.replace('/feed');
          return;
        }
        setSearches(searchesData);
      })
      .catch(() => setSearches([]))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCargar(searchId: string, view: 'match' | 'list') {
    setLoadingSearch(searchId);
    try {
      const res = await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        router.replace(view === 'list' ? '/feed/list' : '/feed');
      }
    } finally {
      setLoadingSearch(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-slate-500">Cargando...</p>
      </main>
    );
  }

  if (searches.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)] mb-2">{PRODUCT_NAME}</h1>
          <p className="text-[var(--mp-muted)] mb-8">
            Definí qué buscás y verás el Match filtrado. Sin búsquedas guardadas aún.
          </p>
          <Link
            href="/assistant"
            className="inline-block px-6 py-3 rounded-xl font-semibold bg-[var(--mp-accent)] text-white hover:opacity-90"
          >
            Buscar
          </Link>
          <p className="mt-6 text-sm text-[var(--mp-muted)]">
            <Link href="/feed" className="text-[var(--mp-accent)] hover:underline">
              Ver todo el catálogo
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="w-full max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-[var(--mp-foreground)] mb-1">{PRODUCT_NAME}</h1>
        <p className="text-sm text-[var(--mp-muted)] mb-6">
          Elegí una búsqueda para ver Match o lista.
        </p>

        <ul className="space-y-3 mb-8">
          {searches.map((s) => (
            <li
              key={s.id}
              className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-[var(--mp-accent)]/30 transition-colors"
            >
              <h2 className="font-medium text-[var(--mp-foreground)]">{s.name || 'Sin nombre'}</h2>
              {s.filters && Object.keys(s.filters).length > 0 && (
                <p
                  className="text-sm text-[var(--mp-muted)] mt-0.5 truncate"
                  title={filtersToHumanSummary(s.filters)}
                >
                  {filtersToHumanSummary(s.filters)}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleCargar(s.id, 'match')}
                  disabled={!!loadingSearch}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loadingSearch === s.id ? '...' : 'Match'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCargar(s.id, 'list')}
                  disabled={!!loadingSearch}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)] disabled:opacity-50"
                >
                  Lista
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-4 text-sm">
          <Link href="/assistant" className="text-[var(--mp-accent)] font-medium hover:underline">
            Buscar
          </Link>
          <Link href="/feed" className="text-[var(--mp-muted)] hover:underline">
            Ver todo
          </Link>
        </div>
      </div>
    </main>
  );
}
