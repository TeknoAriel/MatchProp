'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  NEW_LISTING: { label: 'Nuevas publicaciones', icon: '🏠', color: 'bg-blue-100 text-blue-800' },
  PRICE_DROP: { label: 'Bajó el precio', icon: '📉', color: 'bg-green-100 text-green-800' },
  BACK_ON_MARKET: {
    label: 'Volvió al mercado',
    icon: '🔄',
    color: 'bg-purple-100 text-purple-800',
  },
};

type Subscription = {
  id: string;
  savedSearchId: string | null;
  savedSearchName: string | null;
  savedSearchQueryText?: string | null;
  type: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
};

type AlertDelivery = {
  id: string;
  listingId: string;
  type: string;
  createdAt: string;
  listingTitle: string | null;
  listingPrice: number | null;
  listingCurrency: string | null;
  savedSearchName: string | null;
};

export default function AlertsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' }),
      fetch(`${API_BASE}/alerts/deliveries?limit=30`, { credentials: 'include' }),
    ])
      .then(async ([resSubs, resDeliveries]) => {
        if (resSubs.status === 401 || resDeliveries.status === 401) {
          router.replace('/login');
          return { items: [], deliveries: [] };
        }
        if (!resSubs.ok) throw new Error('Error al cargar alertas');
        const itemsData = await resSubs.json();
        const delData = resDeliveries.ok ? await resDeliveries.json() : { deliveries: [] };
        return {
          items: Array.isArray(itemsData) ? itemsData : [],
          deliveries: Array.isArray(delData?.deliveries) ? delData.deliveries : [],
        };
      })
      .then(({ items: i, deliveries: d }) => {
        setItems(i);
        setDeliveries(d);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : 'No pudimos cargar las alertas. Intentá de nuevo.'
        )
      )
      .finally(() => setLoading(false));
  }, [router]);

  async function toggleEnabled(sub: Subscription) {
    setTogglingId(sub.id);
    try {
      const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: !sub.isEnabled }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        const nextEnabled = !sub.isEnabled;
        setItems((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, isEnabled: nextEnabled } : s))
        );
        // Refrescar deliveries por si cambió qué está activo
        fetch(`${API_BASE}/alerts/deliveries?limit=30`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { deliveries: [] }))
          .then((d) => setDeliveries(Array.isArray(d?.deliveries) ? d.deliveries : []))
          .catch(() => {});
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteSub(id: string) {
    const res = await fetch(`${API_BASE}/alerts/subscriptions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) setItems((prev) => prev.filter((s) => s.id !== id));
  }

  async function verResultados(sub: Subscription) {
    if (!sub.savedSearchId) return;
    await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId: sub.savedSearchId }),
    });
    router.push('/feed/list');
  }

  if (loading) {
    return (
      <main className="py-2 min-h-[60vh]">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2].map((k) => (
            <div
              key={k}
              className="h-28 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/dashboard" className="text-sky-600 hover:underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">Mis alertas</h1>
          <p className="text-sm text-[var(--mp-muted)]">Recibí avisos cuando haya novedades</p>
        </div>
        <Link
          href="/searches"
          className="px-4 py-2 text-sm bg-sky-500 text-white rounded-xl hover:bg-sky-600"
        >
          + Nueva
        </Link>
      </div>

      {deliveries.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)]">
          <h2 className="text-lg font-semibold text-[var(--mp-foreground)] mb-3">
            Resultado de alertas
          </h2>
          <p className="text-sm text-[var(--mp-muted)] mb-3">
            Propiedades que dispararon tus alertas activas
          </p>
          <ul className="space-y-3 mb-4">
            {deliveries.map((d) => {
              const typeInfo = TYPE_LABELS[d.type] ?? {
                label: d.type,
                icon: '🔔',
                color: 'bg-gray-100 text-gray-800',
              };
              return (
                <li
                  key={d.id}
                  className="rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-bg)] overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}
                      >
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <span
                        className="text-xs text-[var(--mp-muted)] shrink-0"
                        suppressHydrationWarning
                      >
                        {new Date(d.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="font-medium text-[var(--mp-foreground)] truncate">
                      {d.listingTitle ?? d.listingId}
                    </p>
                    {d.savedSearchName && (
                      <p className="text-xs text-[var(--mp-muted)] truncate mt-0.5">
                        {d.savedSearchName}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-sky-700 mt-1">
                      {d.listingPrice != null
                        ? `${d.listingCurrency ?? 'USD'} ${d.listingPrice.toLocaleString()}`
                        : 'Consultar'}
                    </p>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/listing/${d.listingId}`}
                        className="text-center py-2.5 px-3 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600"
                      >
                        Ver ficha
                      </Link>
                      <Link
                        href="/me/match"
                        className="text-center py-2.5 px-3 rounded-xl bg-slate-100 text-[var(--mp-foreground)] font-semibold text-sm border border-[var(--mp-border)] hover:bg-slate-200/80"
                      >
                        Mis match
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/me/match" className="text-sm font-medium text-sky-600 hover:underline">
            Ver en Mis match →
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sky-50 flex items-center justify-center">
            <span className="text-3xl">🔔</span>
          </div>
          <h3 className="font-medium text-[var(--mp-foreground)] mb-2">No tenés alertas activas</h3>
          <p className="text-sm text-[var(--mp-muted)] mb-4">
            Creá una búsqueda y activá alertas para recibir avisos
          </p>
          <Link
            href="/searches"
            className="inline-block px-6 py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600"
          >
            Ver mis búsquedas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((sub) => {
            const typeInfo = TYPE_LABELS[sub.type] ?? {
              label: sub.type,
              icon: '🔔',
              color: 'bg-gray-100 text-gray-800',
            };

            return (
              <div
                key={sub.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  sub.isEnabled
                    ? 'bg-[var(--mp-card)] border-[var(--mp-border)]'
                    : 'bg-gray-50 border-gray-200 opacity-75'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        sub.isEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {sub.isEnabled ? 'Activa' : 'Pausada'}
                    </span>
                  </div>

                  <h3 className="font-medium text-[var(--mp-foreground)] truncate">
                    {sub.savedSearchName ?? 'Búsqueda guardada'}
                  </h3>
                  {(sub.savedSearchQueryText ?? '').trim() && (
                    <p className="text-sm text-[var(--mp-muted)] mt-0.5 line-clamp-2">
                      {sub.savedSearchQueryText}
                    </p>
                  )}

                  <p className="text-xs text-[var(--mp-muted)] mt-1">
                    {sub.lastRunAt && (
                      <>Última: {new Date(sub.lastRunAt).toLocaleDateString('es-AR')}</>
                    )}
                  </p>
                </div>

                <div className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={togglingId === sub.id}
                      onClick={() => toggleEnabled(sub)}
                      className={`py-2.5 px-3 rounded-xl font-semibold text-sm border transition-colors ${
                        sub.isEnabled
                          ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                          : 'bg-slate-100 text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-slate-200/80'
                      } disabled:opacity-60`}
                    >
                      {togglingId === sub.id ? 'Guardando…' : sub.isEnabled ? 'Pausar' : 'Activar'}
                    </button>
                    {sub.savedSearchId ? (
                      <button
                        type="button"
                        onClick={() => verResultados(sub)}
                        className="py-2.5 px-3 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600"
                      >
                        Ver resultados
                      </button>
                    ) : (
                      <div />
                    )}
                    {sub.savedSearchId ? (
                      <Link
                        href={`/searches/${sub.savedSearchId}`}
                        className="col-span-2 text-center py-2.5 px-3 rounded-xl bg-sky-50 text-sky-900 border border-sky-200 font-semibold text-sm hover:bg-sky-100"
                      >
                        Ir a la búsqueda
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('¿Eliminar esta alerta?')) return;
                        deleteSub(sub.id);
                      }}
                      className="col-span-2 py-2.5 px-3 rounded-xl bg-red-50 text-red-700 border border-red-100 font-semibold text-sm hover:bg-red-100"
                    >
                      Eliminar alerta
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-sky-50 border border-sky-100">
        <p className="text-sm text-sky-800">
          <strong>💡 Tip:</strong> Podés tener alertas de diferentes tipos para la misma búsqueda:
          nuevas publicaciones, bajas de precio, o propiedades que vuelven al mercado.
        </p>
      </div>
    </main>
  );
}
