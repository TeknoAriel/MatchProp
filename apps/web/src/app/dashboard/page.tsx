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
        const [activeData, searchesData] = await Promise.all([
          activeRes.ok ? activeRes.json() : { search: null },
          searchesRes.ok ? searchesRes.json() : [],
        ]);
        if (activeData?.search) {
          router.replace('/feed');
          return;
        }
        setSearches(Array.isArray(searchesData) ? searchesData : []);
      })
      .catch(() => {})
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
      <main className="min-h-screen p-4">
        <div className="max-w-lg mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{PRODUCT_NAME}</h1>
          <p className="text-slate-600 mb-6">
            No tenés búsquedas guardadas. Creá una para ver el Match con propiedades filtradas.
          </p>
          <Link
            href="/assistant"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            Con asistente
          </Link>
          <p className="mt-6 text-sm text-slate-500">
            O{' '}
            <Link href="/feed" className="text-blue-600 hover:underline">
              ver todo el feed
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{PRODUCT_NAME}</h1>
        <p className="text-slate-600 mb-6">
          Cargá una búsqueda para ver el Match. Luego podés ver en lista.
        </p>

        <div className="space-y-3 mb-8">
          {searches.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="font-medium text-slate-900">{s.name || 'Búsqueda sin nombre'}</h2>
              {s.filters && Object.keys(s.filters).length > 0 && (
                <p
                  className="text-sm text-slate-600 mt-1 truncate"
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
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {loadingSearch === s.id ? 'Cargando...' : 'Cargar y ver Match'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCargar(s.id, 'list')}
                  disabled={!!loadingSearch}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 font-medium disabled:opacity-50"
                >
                  Ver en lista
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 text-sm">
          <Link href="/assistant" className="text-blue-600 hover:underline">
            Crear nueva búsqueda
          </Link>
          <Link href="/feed" className="text-slate-600 hover:underline">
            Ver todo (sin filtros)
          </Link>
        </div>
      </div>
    </main>
  );
}
