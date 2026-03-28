'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MpSecondaryNav, SECONDARY_NAV_HUB } from '../../components/MpSecondaryNav';
import { CardToolbar, ToolbarBtn, ToolbarLink, ToolbarRow } from '../../components/MpCardToolbar';
import AlertSubscriptionModal from '../../components/AlertSubscriptionModal';
import type { AlertSubscriptionForModal } from '../../components/AlertSubscriptionModal';
import AlertDeliveryModal from '../../components/AlertDeliveryModal';
import type { AlertDeliveryRow } from '../../components/AlertDeliveryModal';

const API_BASE = '/api';

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  NEW_LISTING: { label: 'Nuevas publicaciones', icon: '🏠' },
  PRICE_DROP: { label: 'Bajó el precio', icon: '📉' },
  BACK_ON_MARKET: { label: 'Volvió al mercado', icon: '🔄' },
};

const typeChipClass =
  'px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--mp-border)] bg-[var(--mp-bg)] text-[var(--mp-foreground)]';

type Subscription = AlertSubscriptionForModal;

type AlertDelivery = AlertDeliveryRow;

export default function AlertsPage() {
  const router = useRouter();
  const pathname = usePathname();
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

  async function handleDeliveryNope(listingId: string) {
    try {
      await fetch(`${API_BASE}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, decision: 'NOPE' }),
      });
      setDeliveries((prev) => prev.filter((d) => d.listingId !== listingId));
      setToast('Descartada');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('No pudimos registrar el descarte. Probá de nuevo.');
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleDeliveryLike(listingId: string) {
    try {
      await fetch(`${API_BASE}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, listType: 'LATER' }),
      });
      await fetch(`${API_BASE}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, decision: 'LIKE' }),
      });
      setToast('Guardada en tus match');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('No pudimos guardar. Probá de nuevo.');
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
      {toast && <div className="mb-3 mp-callout font-medium">{toast}</div>}

      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">Mis alertas</h1>
            <p className="text-sm text-[var(--mp-muted)]">Recibí avisos cuando haya novedades</p>
          </div>
          <Link
            href="/searches"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-[var(--mp-radius-chip)] bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] shadow-sm"
          >
            + Nueva
          </Link>
        </div>
        <MpSecondaryNav items={SECONDARY_NAV_HUB} pathname={pathname} />
      </div>

      {deliveries.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl mp-surface">
          <h2 className="text-lg font-semibold text-[var(--mp-foreground)] mb-1">
            Resultado de alertas
          </h2>
          <p className="text-sm text-[var(--mp-muted)] mb-4">
            Descartá a la izquierda o guardá en tus match a la derecha — misma lógica que el deck
          </p>
          <ul className="space-y-4 mb-4">
            {deliveries.map((d) => {
              const typeInfo = TYPE_LABELS[d.type] ?? {
                label: d.type,
                icon: '🔔',
              };
              return (
                <li key={d.id} className="rounded-2xl mp-surface overflow-hidden">
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={typeChipClass}>
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
                    <p className="text-base font-bold text-[var(--mp-accent)] mt-2">
                      {d.listingPrice != null
                        ? `${d.listingCurrency ?? 'USD'} ${d.listingPrice.toLocaleString()}`
                        : 'Consultar'}
                    </p>
                  </div>
                  <CardToolbar>
                    <ToolbarRow className="w-full justify-between gap-2">
                      <ToolbarBtn
                        icon="👎"
                        label="Descartar"
                        variant="danger"
                        onClick={() => void handleDeliveryNope(d.listingId)}
                      />
                      <ToolbarBtn
                        icon="💚"
                        label="Me interesa"
                        variant="primary"
                        onClick={() => void handleDeliveryLike(d.listingId)}
                      />
                    </ToolbarRow>
                    <ToolbarRow className="w-full">
                      <ToolbarLink href={`/listing/${d.listingId}`} icon="📄" label="Ficha" />
                      <ToolbarLink href="/feed" icon="🎯" label="Deck" />
                      <ToolbarLink href="/me/match" icon="⭐" label="Mis match" />
                      <ToolbarBtn
                        icon="🔗"
                        label="Copiar"
                        variant="muted"
                        onClick={() => void copyListingLink(d.listingId)}
                      />
                      <ToolbarLink href="/searches" icon="📁" label="Búsquedas" />
                    </ToolbarRow>
                  </CardToolbar>
                </li>
              );
            })}
          </ul>
          <Link
            href="/me/match"
            className="text-sm font-semibold text-[var(--mp-accent)] hover:opacity-90 inline-flex items-center gap-1"
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
            };

            const activeCard = sub.isEnabled;

            return (
              <div
                key={sub.id}
                className={`rounded-2xl border overflow-hidden transition-shadow mp-surface ${
                  activeCard ? '' : 'opacity-[0.92]'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={typeChipClass}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          sub.isEnabled
                            ? 'bg-[var(--mp-accent)]/12 text-[var(--mp-accent-hover)] border-[var(--mp-accent)]/30'
                            : 'bg-[var(--mp-bg)] text-[var(--mp-muted)] border-[var(--mp-border)]'
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

                <CardToolbar>
                  <button
                    type="button"
                    disabled={togglingId === sub.id}
                    onClick={() => toggleEnabled(sub)}
                    className={`w-full py-2.5 px-4 rounded-[var(--mp-radius-chip)] font-semibold text-sm border flex items-center justify-center gap-2 transition-colors ${
                      sub.isEnabled
                        ? 'bg-[var(--mp-accent)] text-white border-[var(--mp-accent-hover)] hover:opacity-[0.96]'
                        : 'bg-[var(--mp-card)] text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-[var(--mp-bg)]'
                    } disabled:opacity-60`}
                  >
                    <span className="text-lg" aria-hidden>
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
                      <ToolbarRow className="w-full">
                        <ToolbarBtn
                          icon="📋"
                          label="Lista"
                          onClick={() => void verResultados(sub)}
                        />
                        <ToolbarBtn
                          icon="🎯"
                          label="Deck"
                          variant="primary"
                          onClick={() => void irAlDeck(sub)}
                        />
                        <ToolbarLink
                          href={`/searches/${sub.savedSearchId}`}
                          icon="✏️"
                          label="Editar"
                        />
                      </ToolbarRow>
                      <ToolbarRow className="w-full">
                        <ToolbarLink href="/assistant" icon="🔍" label="Asistente" />
                        <ToolbarLink href="/searches" icon="📁" label="Búsquedas" />
                      </ToolbarRow>
                    </>
                  ) : (
                    <ToolbarLink href="/searches" icon="📁" label="Ver búsquedas" />
                  )}

                  <ToolbarBtn
                    icon="🗑️"
                    label="Eliminar"
                    variant="danger"
                    className="w-full justify-center"
                    onClick={() => {
                      if (!confirm('¿Eliminar esta alerta?')) return;
                      void deleteSub(sub.id);
                    }}
                  />
                </CardToolbar>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-bg)]">
        <p className="text-sm text-[var(--mp-foreground)]">
          <strong>💡 Tip:</strong> Podés combinar varios tipos de alerta por búsqueda. En{' '}
          <strong>Resultado de alertas</strong>, descartá a la izquierda o guardá a la derecha como
          en el deck Match.
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
