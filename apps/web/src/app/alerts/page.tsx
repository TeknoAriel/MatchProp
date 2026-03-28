'use client';

import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AlertSubscriptionModal from '../../components/AlertSubscriptionModal';
import type { AlertSubscriptionForModal } from '../../components/AlertSubscriptionModal';
import AlertDeliveryModal from '../../components/AlertDeliveryModal';
import type { AlertDeliveryRow } from '../../components/AlertDeliveryModal';

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

type Subscription = AlertSubscriptionForModal;

type AlertDelivery = AlertDeliveryRow;

/** Botón compacto icono + etiqueta (primera pantalla) */
function IconAction({
  icon,
  label,
  className,
  ...props
}: { icon: string; label: string; className?: string } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center justify-center gap-1 min-h-[72px] px-2 py-2 rounded-xl border font-semibold text-[11px] leading-tight text-center transition-colors disabled:opacity-50 ${className ?? ''}`}
      {...props}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {icon}
      </span>
      <span className="uppercase tracking-wide">{label}</span>
    </button>
  );
}

function IconLink({
  icon,
  label,
  className,
  href,
}: {
  icon: string;
  label: string;
  className?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 min-h-[72px] px-2 py-2 rounded-xl border font-semibold text-[11px] leading-tight text-center transition-colors ${className ?? ''}`}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {icon}
      </span>
      <span className="uppercase tracking-wide">{label}</span>
    </Link>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [subModal, setSubModal] = useState<Subscription | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<AlertDelivery | null>(null);

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
        setSubModal((m) => (m?.id === sub.id ? { ...m, isEnabled: nextEnabled } : m));
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
    else if (res.ok) {
      setItems((prev) => prev.filter((s) => s.id !== id));
      setSubModal((m) => (m?.id === id ? null : m));
    }
  }

  async function setActiveSearchAndGo(searchId: string, path: '/feed/list' | '/feed') {
    await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId }),
    });
    router.push(path);
  }

  async function verResultados(sub: Subscription) {
    if (!sub.savedSearchId) return;
    await setActiveSearchAndGo(sub.savedSearchId, '/feed/list');
  }

  async function irAlDeck(sub: Subscription) {
    if (!sub.savedSearchId) {
      router.push('/feed');
      return;
    }
    await setActiveSearchAndGo(sub.savedSearchId, '/feed');
  }

  async function copyListingLink(listingId: string) {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/listing/${listingId}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Enlace copiado al portapapeles');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('No se pudo copiar. Probá desde la barra de direcciones.');
      setTimeout(() => setToast(null), 3000);
    }
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
      {toast && (
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">Mis alertas</h1>
          <p className="text-sm text-[var(--mp-muted)]">Recibí avisos cuando haya novedades</p>
        </div>
        <Link
          href="/searches"
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium shadow-sm"
        >
          + Nueva
        </Link>
      </div>

      {deliveries.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-b from-emerald-50/40 to-[var(--mp-card)] border border-emerald-200/70 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--mp-foreground)] mb-1">
            Resultado de alertas
          </h2>
          <p className="text-sm text-[var(--mp-muted)] mb-4">
            Propiedades que dispararon tus alertas — acciones rápidas en cada ficha
          </p>
          <ul className="space-y-4 mb-4">
            {deliveries.map((d) => {
              const typeInfo = TYPE_LABELS[d.type] ?? {
                label: d.type,
                icon: '🔔',
                color: 'bg-gray-100 text-gray-800',
              };
              return (
                <li
                  key={d.id}
                  className="rounded-2xl border border-emerald-200/60 bg-[var(--mp-card)] overflow-hidden shadow-sm"
                >
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}
                      >
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-[var(--mp-muted)]" suppressHydrationWarning>
                          {new Date(d.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                        <button
                          type="button"
                          aria-label="Acciones del aviso"
                          onClick={() => setDeliveryModal(d)}
                          className="ml-1 w-9 h-9 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-bg)] text-[var(--mp-foreground)] text-lg leading-none hover:bg-emerald-50 hover:border-emerald-300"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                    <p className="font-medium text-[var(--mp-foreground)] line-clamp-2">
                      {d.listingTitle ?? d.listingId}
                    </p>
                    {d.savedSearchName && (
                      <p className="text-xs text-[var(--mp-muted)] truncate mt-0.5">
                        {d.savedSearchName}
                      </p>
                    )}
                    <p className="text-base font-bold text-sky-700 mt-2">
                      {d.listingPrice != null
                        ? `${d.listingCurrency ?? 'USD'} ${d.listingPrice.toLocaleString()}`
                        : 'Consultar'}
                    </p>
                  </div>
                  <div className="px-3 pb-3 pt-0 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <IconLink
                        href={`/listing/${d.listingId}`}
                        icon="📄"
                        label="Ficha"
                        className="bg-sky-500 text-white border-sky-600 hover:bg-sky-600"
                      />
                      <IconLink
                        href="/me/match"
                        icon="💚"
                        label="Match"
                        className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                      />
                      <IconLink
                        href="/feed"
                        icon="💫"
                        label="Deck"
                        className="bg-violet-600 text-white border-violet-700 hover:bg-violet-700"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <IconAction
                        icon="🔗"
                        label="Copiar link"
                        className="bg-white text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-slate-50"
                        onClick={() => void copyListingLink(d.listingId)}
                      />
                      <IconLink
                        href="/searches"
                        icon="🔔"
                        label="Búsquedas"
                        className="bg-slate-100 text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-slate-200/80"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/me/match"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            Ver todo en Mis match →
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
            <span className="text-3xl">🔔</span>
          </div>
          <h3 className="font-medium text-[var(--mp-foreground)] mb-2">No tenés alertas activas</h3>
          <p className="text-sm text-[var(--mp-muted)] mb-4">
            Creá una búsqueda y activá alertas para recibir avisos
          </p>
          <Link
            href="/searches"
            className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
          >
            Ver mis búsquedas
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((sub) => {
            const typeInfo = TYPE_LABELS[sub.type] ?? {
              label: sub.type,
              icon: '🔔',
              color: 'bg-gray-100 text-gray-800',
            };

            const activeCard = sub.isEnabled;

            return (
              <div
                key={sub.id}
                className={`rounded-2xl border overflow-hidden transition-shadow ${
                  activeCard
                    ? 'border-emerald-300/80 bg-gradient-to-b from-emerald-50/70 via-white to-[var(--mp-card)] shadow-md shadow-emerald-900/10'
                    : 'bg-gray-50 border-gray-200 opacity-90'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          sub.isEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {sub.isEnabled ? 'Activa' : 'Pausada'}
                      </span>
                      <button
                        type="button"
                        aria-label="Acciones de alerta"
                        onClick={() => setSubModal(sub)}
                        className="w-9 h-9 rounded-xl border border-emerald-200/80 bg-white/90 text-[var(--mp-foreground)] text-lg leading-none hover:bg-emerald-50 shadow-sm"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-[var(--mp-foreground)] truncate">
                    {sub.savedSearchName ?? 'Búsqueda guardada'}
                  </h3>
                  {(sub.savedSearchQueryText ?? '').trim() && (
                    <p className="text-sm text-[var(--mp-muted)] mt-1 line-clamp-2">
                      {sub.savedSearchQueryText}
                    </p>
                  )}

                  <p className="text-xs text-[var(--mp-muted)] mt-2">
                    {sub.lastRunAt && (
                      <>Última corrida: {new Date(sub.lastRunAt).toLocaleDateString('es-AR')}</>
                    )}
                  </p>
                </div>

                <div className="px-3 pb-4 pt-0 space-y-2">
                  <button
                    type="button"
                    disabled={togglingId === sub.id}
                    onClick={() => toggleEnabled(sub)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-colors ${
                      sub.isEnabled
                        ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-sm'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                    } disabled:opacity-60`}
                  >
                    <span className="text-xl" aria-hidden>
                      {sub.isEnabled ? '⏸' : '▶'}
                    </span>
                    {togglingId === sub.id
                      ? 'Guardando…'
                      : sub.isEnabled
                        ? 'Pausar alerta'
                        : 'Activar alerta'}
                  </button>

                  {sub.savedSearchId ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <IconAction
                          icon="📋"
                          label="Listado"
                          className="bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => void verResultados(sub)}
                        />
                        <IconAction
                          icon="💫"
                          label="Deck"
                          className="bg-violet-600 text-white border-violet-700 hover:bg-violet-700"
                          onClick={() => void irAlDeck(sub)}
                        />
                        <IconLink
                          href={`/searches/${sub.savedSearchId}`}
                          icon="✏️"
                          label="Editar"
                          className="bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <IconLink
                          href="/assistant"
                          icon="🔍"
                          label="Asistente"
                          className="bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100"
                        />
                        <IconLink
                          href="/searches"
                          icon="📂"
                          label="Búsquedas"
                          className="bg-slate-100 text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-slate-200/80"
                        />
                      </div>
                    </>
                  ) : (
                    <IconLink
                      href="/searches"
                      icon="📂"
                      label="Ver búsquedas"
                      className="w-full bg-slate-100 text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-slate-200/80"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('¿Eliminar esta alerta?')) return;
                      void deleteSub(sub.id);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-red-50 text-red-700 border border-red-100 font-semibold text-sm hover:bg-red-100 flex items-center justify-center gap-2"
                  >
                    <span className="text-lg" aria-hidden>
                      🗑️
                    </span>
                    Eliminar alerta
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100">
        <p className="text-sm text-emerald-900">
          <strong className="text-emerald-800">💡 Tip:</strong> Podés tener alertas de distintos
          tipos para la misma búsqueda: nuevas publicaciones, bajas de precio o propiedades que
          vuelven al mercado. Usá <strong>Listado</strong> para revisar en tabla o{' '}
          <strong>Deck</strong> para decidir con swipe.
        </p>
      </div>

      <AlertSubscriptionModal
        open={subModal != null}
        sub={subModal}
        onClose={() => setSubModal(null)}
        togglingId={togglingId}
        onToggle={(s) => void toggleEnabled(s)}
        onVerResultados={(s) => void verResultados(s)}
        onIrAlDeck={(s) => void irAlDeck(s)}
        onDelete={(id) => void deleteSub(id)}
      />

      <AlertDeliveryModal
        open={deliveryModal != null}
        delivery={deliveryModal}
        onClose={() => setDeliveryModal(null)}
      />
    </main>
  );
}
