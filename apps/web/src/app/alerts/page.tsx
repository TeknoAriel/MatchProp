'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ActiveSearchBar from '../../components/ActiveSearchBar';

const API_BASE = '/api';

const TYPE_LABELS: Record<string, string> = {
  NEW_LISTING: 'Nuevas publicaciones',
  PRICE_DROP: 'Bajó precio',
  BACK_ON_MARKET: 'Volvió a estar activa',
};

type Subscription = {
  id: string;
  savedSearchId: string | null;
  savedSearchName: string | null;
  type: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
};

export default function AlertsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [loadingResult, setLoadingResult] = useState<string | null>(null);

  function fetchSubs() {
    return fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          setUnauth(true);
          return [];
        }
        if (!res.ok) {
          setApiDown(true);
          return [];
        }
        return res.json();
      })
      .then(setItems);
  }

  useEffect(() => {
    fetchSubs()
      .catch(() => setApiDown(true))
      .finally(() => setLoading(false));
  }, []);

  async function toggleEnabled(sub: Subscription) {
    const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isEnabled: !sub.isEnabled }),
    });
    if (res.status === 401) window.location.href = '/login';
    else if (res.ok)
      setItems((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, isEnabled: !s.isEnabled } : s))
      );
  }

  async function deleteSub(id: string) {
    const res = await fetch(`${API_BASE}/alerts/subscriptions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) window.location.href = '/login';
    else if (res.ok) setItems((prev) => prev.filter((s) => s.id !== id));
  }

  async function verResultados(sub: Subscription) {
    if (!sub.savedSearchId) return;
    setLoadingResult(sub.id);
    try {
      const res = await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId: sub.savedSearchId }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) router.push('/feed');
    } finally {
      setLoadingResult(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (unauth) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <p className="text-amber-600">Iniciá sesión para ver alertas.</p>
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
          <Link href="/searches" className="text-sm text-blue-600 hover:underline">
            Búsquedas
          </Link>
        </div>

        <h1 className="text-xl font-bold mb-4">Alertas</h1>
        <p className="text-sm text-gray-600 mb-4">
          Alertas de nuevas publicaciones, bajas de precio y propiedades que vuelven al mercado.
        </p>

        <div className="space-y-3">
          {items.map((sub) => (
            <div
              key={sub.id}
              className="p-4 border rounded-lg bg-white flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{sub.savedSearchName ?? 'Búsqueda'}</p>
                <p className="text-xs text-gray-500">
                  {TYPE_LABELS[sub.type] ?? sub.type} · {sub.isEnabled ? 'Activa' : 'Pausada'} ·
                  Última: {sub.lastRunAt ? new Date(sub.lastRunAt).toLocaleString() : 'Nunca'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {sub.savedSearchId && (
                  <button
                    onClick={() => verResultados(sub)}
                    disabled={loadingResult === sub.id}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200 disabled:opacity-60"
                  >
                    {loadingResult === sub.id ? 'Cargando...' : 'Ver resultados'}
                  </button>
                )}
                <button
                  onClick={() => toggleEnabled(sub)}
                  className={`px-3 py-1 rounded text-sm ${sub.isEnabled ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {sub.isEnabled ? 'Pausar' : 'Activar'}
                </button>
                <button
                  onClick={() => deleteSub(sub.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No tenés alertas. Activá una desde una{' '}
            <Link href="/searches" className="text-blue-600 hover:underline">
              búsqueda guardada
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
