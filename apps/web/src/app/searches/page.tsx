'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import { filtersToHumanSummary } from '../../lib/filters-summary';

const API_BASE = '/api';

type AlertType = 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
type SubState = { id: string; isEnabled: boolean } | null;
type AlertDelivery = {
  id: string;
  listingId: string;
  type: string;
  createdAt: string;
  listingTitle: string | null;
  listingPrice: number | null;
  listingCurrency: string | null;
};

const ALERT_LABELS: Record<AlertType, string> = {
  NEW_LISTING: 'Nuevas publicaciones',
  PRICE_DROP: 'Bajó precio',
  BACK_ON_MARKET: 'Volvió al mercado',
};

export default function SearchesPage() {
  const router = useRouter();
  const [items, setItems] = useState<SavedSearchDTO[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [subsBySearch, setSubsBySearch] = useState<Record<string, Record<AlertType, SubState>>>({});
  const [deliveriesBySearch, setDeliveriesBySearch] = useState<Record<string, AlertDelivery[]>>({});

  const fetchItems = useCallback(() => {
    return Promise.all([
      fetch(`${API_BASE}/searches`, { credentials: 'include' }),
      fetch(`${API_BASE}/me/active-search`, { credentials: 'include' }),
    ]).then(async ([resSearches, resActive]) => {
      if (resSearches.status === 401 || resActive.status === 401) {
        setSessionExpired(true);
        setItems([]);
        return;
      }
      if (!resSearches.ok) {
        setApiDown(true);
        return;
      }
      const data = await resSearches.json();
      setItems(Array.isArray(data) ? data : []);
      const activeData = resActive.ok ? await resActive.json() : {};
      setActiveSearchId(activeData.search?.id ?? null);
    });
  }, []);

  useEffect(() => {
    fetchItems()
      .catch(() => setApiDown(true))
      .finally(() => setLoading(false));
  }, [fetchItems]);

  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((s) => s.id);
    Promise.all([
      fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      ),
      ...ids.map((id) =>
        fetch(`${API_BASE}/alerts/deliveries/by-search/${id}?limit=5`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : { deliveries: [] }))
      ),
    ]).then(([subsList, ...deliveryResults]) => {
      const subsMap: Record<string, Record<AlertType, SubState>> = {};
      ids.forEach((id) => {
        subsMap[id] = {
          NEW_LISTING: null,
          PRICE_DROP: null,
          BACK_ON_MARKET: null,
        };
      });
      for (const s of subsList ?? []) {
        if (s.savedSearchId && ids.includes(s.savedSearchId)) {
          const t = s.type as AlertType;
          if (t in subsMap[s.savedSearchId]!) {
            subsMap[s.savedSearchId]![t] = { id: s.id, isEnabled: s.isEnabled };
          }
        }
      }
      setSubsBySearch(subsMap);

      const delMap: Record<string, AlertDelivery[]> = {};
      ids.forEach((id, i) => {
        const d = deliveryResults[i] as { deliveries?: AlertDelivery[] };
        delMap[id] = d?.deliveries ?? [];
      });
      setDeliveriesBySearch(delMap);
    });
  }, [items]);

  async function handleSetActive(searchId: string) {
    const res = await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId }),
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) setActiveSearchId(searchId);
  }

  async function handleMatch(searchId: string) {
    await handleSetActive(searchId);
    router.push('/feed');
  }

  async function handleEditOpen(s: SavedSearchDTO) {
    setEditingId(s.id);
    setEditName(s.name || '');
    setEditText(s.queryText || '');
  }

  async function handleEditSave() {
    if (!editingId || editSaving) return;
    setEditSaving(true);
    try {
      let body: { name?: string; text?: string; filters?: unknown } = { name: editName.trim() || undefined };
      if (editText.trim().length >= 3) {
        const parseRes = await fetch(`${API_BASE}/assistant/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: editText.trim() }),
        });
        if (parseRes.ok) {
          const parsed = await parseRes.json();
          body = { ...body, text: editText.trim(), filters: parsed.filters };
        }
      }
      const res = await fetch(`${API_BASE}/searches/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        await fetchItems();
        setEditingId(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(searchId: string) {
    const res = await fetch(`${API_BASE}/searches/${searchId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) {
      setItems((prev) => prev.filter((s) => s.id !== searchId));
      setDeleteConfirmId(null);
      if (activeSearchId === searchId) setActiveSearchId(null);
    }
  }

  async function handleAlert(searchId: string, type: AlertType, enable: boolean) {
    const sub = subsBySearch[searchId]?.[type];
    if (sub) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: enable }),
      });
      if (res.ok) {
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? { NEW_LISTING: null, PRICE_DROP: null, BACK_ON_MARKET: null };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING: type === 'NEW_LISTING' ? { ...sub, isEnabled: enable } : (base.NEW_LISTING ?? null),
            PRICE_DROP: type === 'PRICE_DROP' ? { ...sub, isEnabled: enable } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET: type === 'BACK_ON_MARKET' ? { ...sub, isEnabled: enable } : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    } else if (enable) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: searchId, type }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? { NEW_LISTING: null, PRICE_DROP: null, BACK_ON_MARKET: null };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING: type === 'NEW_LISTING' ? { id: data.id, isEnabled: true } : (base.NEW_LISTING ?? null),
            PRICE_DROP: type === 'PRICE_DROP' ? { id: data.id, isEnabled: true } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET: type === 'BACK_ON_MARKET' ? { id: data.id, isEnabled: true } : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
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
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-4 mb-6">
          <Link href="/feed" className="text-sm text-sky-600 hover:underline">
            ← Feed
          </Link>
          <Link href="/assistant" className="text-sm text-sky-600 hover:underline">
            Asistente
          </Link>
          <Link href="/alerts" className="text-sm text-sky-600 hover:underline">
            Alertas
          </Link>
        </div>

        <h1 className="text-xl font-bold mb-4">Búsquedas guardadas</h1>

        <div className="space-y-4">
          {items.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-[var(--mp-card)] shadow-sm border border-[var(--mp-border)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-[var(--mp-foreground)]">
                    {s.name || 'Búsqueda sin nombre'}
                  </h2>
                  <p className="text-sm text-[var(--mp-muted)] mt-0.5 break-words">
                    {s.queryText || filtersToHumanSummary(s.filters) || 'Sin criterios'}
                  </p>
                  <p className="text-xs text-[var(--mp-muted)] mt-1" suppressHydrationWarning>
                    {typeof s.updatedAt === 'string'
                      ? new Date(s.updatedAt).toLocaleDateString('es-AR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMatch(s.id)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-600"
                    title="Buscar en modo Match"
                  >
                    Match
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditOpen(s)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  {activeSearchId === s.id ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Activa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetActive(s.id)}
                      className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      Activar
                    </button>
                  )}
                  {deleteConfirmId === s.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs text-slate-600 hover:underline"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(s.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="mt-2 text-sm text-sky-600 hover:underline"
              >
                {expandedId === s.id ? 'Ocultar' : 'Ver'} alertas y resultados
              </button>

              {expandedId === s.id && (
                <div className="mt-3 space-y-3 pt-3 border-t border-[var(--mp-border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--mp-foreground)] mb-2">
                      Activar alertas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(['NEW_LISTING', 'PRICE_DROP', 'BACK_ON_MARKET'] as AlertType[]).map(
                        (type) => {
                          const sub = subsBySearch[s.id]?.[type];
                          const isOn = sub?.isEnabled ?? false;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleAlert(s.id, type, !isOn)}
                              className={`px-2 py-1 text-xs rounded-full ${
                                isOn
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {ALERT_LABELS[type]} {isOn ? '✓' : ''}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--mp-foreground)] mb-2">
                      Resultado de alertas para esta búsqueda
                    </p>
                    {(deliveriesBySearch[s.id] ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--mp-muted)]">
                        Aún no hay alertas disparadas.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {(deliveriesBySearch[s.id] ?? []).map((d) => (
                          <li key={d.id} className="text-sm flex justify-between gap-2">
                            <span className="truncate">{d.listingTitle ?? d.listingId}</span>
                            <span className="text-[var(--mp-muted)] shrink-0">
                              {d.listingPrice != null
                                ? `${d.listingCurrency ?? 'USD'} ${d.listingPrice.toLocaleString()}`
                                : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/searches/${s.id}`}
                      className="text-xs text-sky-600 hover:underline mt-1 inline-block"
                    >
                      Ver resultados completos →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No tenés búsquedas guardadas. Creá una desde el{' '}
            <Link href="/assistant" className="text-sky-600 hover:underline">
              asistente
            </Link>
            .
          </p>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
            <h3 className="font-bold text-slate-900 mb-4">Editar búsqueda</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="Ej: Casa 3 amb Funes"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  Texto de búsqueda (opcional, min 3 caracteres)
                </label>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="Ej: casa 3 dormitorios en Funes hasta 150000 USD"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
