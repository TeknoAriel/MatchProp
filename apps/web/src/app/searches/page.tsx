'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import { filtersToHumanSummary } from '../../lib/filters-summary';

const API_BASE = '/api';

export default function SearchesPage() {
  const [items, setItems] = useState<SavedSearchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/searches`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          setSessionExpired(true);
          setItems([]);
          return null;
        }
        if (!res.ok) {
          setApiDown(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data != null) setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setApiDown(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (sessionExpired) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <p className="text-amber-600">Sesión vencida.</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  if (apiDown) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <p className="text-amber-600">No hay conexión con la API.</p>
        <Link
          href="/status"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ver estado de conexión
        </Link>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Ir a login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <ActiveSearchBar />
      <div className="max-w-lg mx-auto">
        <div className="flex gap-4 mb-6">
          <Link href="/feed" className="text-sm text-blue-600 hover:underline">
            ← Feed
          </Link>
          <Link href="/assistant" className="text-sm text-blue-600 hover:underline">
            Asistente
          </Link>
          <Link href="/alerts" className="text-sm text-blue-600 hover:underline">
            Alertas
          </Link>
        </div>

        <h1 className="text-xl font-bold mb-4">Búsquedas guardadas</h1>

        <div className="space-y-3">
          {items.map((s) => (
            <Link
              key={s.id}
              href={`/searches/${s.id}`}
              className="block p-4 rounded-xl bg-white shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all"
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
              <p className="text-xs text-slate-500 mt-2" suppressHydrationWarning>
                {typeof s.updatedAt === 'string'
                  ? new Date(s.updatedAt).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                  : ''}
              </p>
            </Link>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No tenés búsquedas guardadas. Creá una desde el{' '}
            <Link href="/assistant" className="text-blue-600 hover:underline">
              asistente
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
