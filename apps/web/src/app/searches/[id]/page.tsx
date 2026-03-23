'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import FilterChips from '../../../components/FilterChips';
import InquiryModal from '../../../components/InquiryModal';
import { formatListingPrice } from '../../../lib/format-price';
import ListingCardImageCarousel from '../../../components/ListingCardImageCarousel';

type ListingStatus = {
  inFavorite: boolean;
  inLike: boolean;
  inLists: { id: string; name: string }[];
  lead: { status: string } | null;
};

const API_BASE = '/api';

type AlertType = 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
type SubState = { id: string; isEnabled: boolean } | null;
type AlertState = 'none' | 'loading' | 'active' | 'error';

const ALERT_LABELS: Record<AlertType, string> = {
  NEW_LISTING: 'Nuevas publicaciones',
  PRICE_DROP: 'Bajó precio',
  BACK_ON_MARKET: 'Volvió a estar activa',
};

export default function SearchResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [subs, setSubs] = useState<Record<AlertType, SubState>>({
    NEW_LISTING: null,
    PRICE_DROP: null,
    BACK_ON_MARKET: null,
  });
  const [alertState, setAlertState] = useState<Record<AlertType, AlertState>>({
    NEW_LISTING: 'none',
    PRICE_DROP: 'none',
    BACK_ON_MARKET: 'none',
  });
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string | null>(null);
  const [operationFilter, setOperationFilter] = useState<'SALE' | 'RENT' | null>(null);
  const [listingsStatus, setListingsStatus] = useState<Record<string, ListingStatus>>({});
  const [addToListCard, setAddToListCard] = useState<ListingCard | null>(null);
  const [newListName, setNewListName] = useState('');
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const ids = items.filter((c) => c.id).map((c) => c.id);
    if (ids.length === 0) {
      setListingsStatus({});
      return;
    }
    fetch(`${API_BASE}/listings/my-status-bulk?ids=${ids.join(',')}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then((data: { items?: Record<string, ListingStatus> }) =>
        setListingsStatus(data.items ?? {})
      )
      .catch(() => setListingsStatus({}));
  }, [items]);

  function handleConsultaSent(listingId: string) {
    setListingsStatus((prev) => ({
      ...prev,
      [listingId]: {
        ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
        lead: { status: 'PENDING' },
      },
    }));
  }

  async function handleToggleLike(listingId: string) {
    const s = listingsStatus[listingId];
    const inLike = s?.inLike ?? false;
    try {
      if (inLike) {
        const del = await fetch(`${API_BASE}/me/saved/${listingId}?listType=LATER`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (del.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inLike: false,
            },
          }));
        }
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId, listType: 'LATER' }),
        });
        if (res.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inLike: true,
            },
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function handleToggleFavorite(listingId: string) {
    const s = listingsStatus[listingId];
    const inFav = s?.inFavorite ?? false;
    try {
      if (inFav) {
        const del = await fetch(`${API_BASE}/me/saved/${listingId}?listType=FAVORITE`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (del.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: false,
            },
          }));
        }
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
        });
        if (res.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: true,
            },
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }

  function handleAgregarALista(card: ListingCard) {
    setAddToListCard(card);
    fetch(`${API_BASE}/me/lists`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data: { lists?: { id: string; name: string; count: number }[] }) =>
        setCustomLists(data?.lists ?? [])
      )
      .catch(() => setCustomLists([]));
  }

  async function handleSaveToList(listingId: string) {
    const res = await fetch(`${API_BASE}/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
    });
    if (res.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [listingId]: {
          inFavorite: true,
          inLike: prev[listingId]?.inLike ?? false,
          inLists: prev[listingId]?.inLists ?? [],
          lead: prev[listingId]?.lead ?? null,
        },
      }));
      setAddToListCard(null);
    }
  }

  async function handleAddToCustomList(listId: string) {
    if (!addToListCard) return;
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId: addToListCard.id }),
    });
    if (res.ok) {
      const list = customLists.find((l) => l.id === listId);
      if (list) {
        setListingsStatus((prev) => ({
          ...prev,
          [addToListCard.id]: {
            inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
            inLike: prev[addToListCard.id]?.inLike ?? false,
            inLists: [...(prev[addToListCard.id]?.inLists ?? []), { id: list.id, name: list.name }],
            lead: prev[addToListCard.id]?.lead ?? null,
          },
        }));
      }
      setAddToListCard(null);
    }
  }

  async function handleNuevaListaSubmit() {
    if (!addToListCard) return;
    const name = newListName.trim();
    if (!name) return;
    const createRes = await fetch(`${API_BASE}/me/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!createRes.ok) return;
    const list = (await createRes.json()) as { id: string };
    const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId: addToListCard.id }),
    });
    if (addRes.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [addToListCard.id]: {
          inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
          inLike: prev[addToListCard.id]?.inLike ?? false,
          inLists: [...(prev[addToListCard.id]?.inLists ?? []), { id: list.id, name }],
          lead: prev[addToListCard.id]?.lead ?? null,
        },
      }));
      setCustomLists((prev) => [...prev, { id: list.id, name, count: 1 }]);
      setNewListName('');
      setAddToListCard(null);
    }
  }

  async function handleRemoveFromList(listId: string, listingId: string) {
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items/${listingId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setListingsStatus((prev) => {
        const cur = prev[listingId];
        if (!cur) return prev;
        return {
          ...prev,
          [listingId]: { ...cur, inLists: cur.inLists.filter((l) => l.id !== listId) },
        };
      });
    }
  }

  const fetchResults = useCallback(
    async (
      cursor?: string | null,
      propType?: string | null,
      operation?: 'SALE' | 'RENT' | null
    ) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      if (propType) params.set('propertyTypes', propType);
      if (operation) params.set('operationType', operation);
      const res = await fetch(`${API_BASE}/searches/${id}/results?${params}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    [id, router]
  );

  useEffect(() => {
    setLoading(true);
    fetchResults(null, propertyTypeFilter, operationFilter)
      .then((data) => {
        if (data) {
          setItems(data.items ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fetchResults, propertyTypeFilter, operationFilter]);

  useEffect(() => {
    fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return [];
        }
        return res.ok ? res.json() : [];
      })
      .then(
        (
          list: { id: string; savedSearchId: string | null; type: string; isEnabled: boolean }[]
        ) => {
          const next: Record<AlertType, SubState> = {
            NEW_LISTING: null,
            PRICE_DROP: null,
            BACK_ON_MARKET: null,
          };
          const nextState: Record<AlertType, AlertState> = {
            NEW_LISTING: 'none',
            PRICE_DROP: 'none',
            BACK_ON_MARKET: 'none',
          };
          for (const s of list) {
            if (
              s.savedSearchId === id &&
              (s.type === 'NEW_LISTING' || s.type === 'PRICE_DROP' || s.type === 'BACK_ON_MARKET')
            ) {
              next[s.type as AlertType] = { id: s.id, isEnabled: s.isEnabled };
              nextState[s.type as AlertType] = s.isEnabled ? 'active' : 'none';
            }
          }
          setSubs(next);
          setAlertState(nextState);
        }
      )
      .catch(() => {});
  }, [id, router]);

  async function handleAlert(type: AlertType, enable: boolean) {
    setAlertState((prev) => ({ ...prev, [type]: 'loading' }));
    const sub = subs[type];
    if (sub) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: enable }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        setSubs((prev) => ({
          ...prev,
          [type]: prev[type] ? { ...prev[type]!, isEnabled: enable } : null,
        }));
        setAlertState((prev) => ({ ...prev, [type]: enable ? 'active' : 'none' }));
      } else {
        setAlertState((prev) => ({ ...prev, [type]: 'error' }));
      }
    } else {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: id, type }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSubs((prev) => ({ ...prev, [type]: { id: data.id, isEnabled: true } }));
        setAlertState((prev) => ({ ...prev, [type]: 'active' }));
      } else {
        setAlertState((prev) => ({ ...prev, [type]: 'error' }));
      }
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchResults(nextCursor, propertyTypeFilter, operationFilter);
    if (data?.items?.length) {
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor ?? null);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex gap-4 mb-4">
          <Link href="/feed" className="text-sm text-blue-600 hover:underline">
            ← Volver al feed swipe
          </Link>
          <Link href="/searches" className="text-sm text-blue-600 hover:underline">
            Búsquedas
          </Link>
        </div>

        <h1 className="text-xl font-bold mb-4">Resultados</h1>

        <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100/80">
          <FilterChips
            operationFilter={operationFilter}
            propertyTypeFilter={propertyTypeFilter}
            onOperationChange={setOperationFilter}
            onPropertyTypeChange={setPropertyTypeFilter}
            disabled={loading}
          />
        </div>

        <div className="mb-4 p-3 rounded-xl bg-white shadow-sm border border-slate-100/80 space-y-2">
          <p className="text-sm font-medium text-gray-700">Alertas</p>
          {(['NEW_LISTING', 'PRICE_DROP', 'BACK_ON_MARKET'] as AlertType[]).map((type) => (
            <div key={type} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{ALERT_LABELS[type]}</span>
              {alertState[type] === 'loading' && <span className="text-xs text-gray-500">...</span>}
              {alertState[type] === 'error' && <span className="text-xs text-red-600">Error</span>}
              {alertState[type] !== 'loading' && alertState[type] !== 'error' && (
                <>
                  {subs[type]?.isEnabled ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">Activa</span>
                      <button
                        onClick={() => handleAlert(type, false)}
                        className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
                      >
                        Pausar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAlert(type, true)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Activar
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <Link
            href="/alerts"
            className="text-sm font-medium text-blue-600 hover:underline block mt-2"
          >
            Ver todas las alertas y configurar push →
          </Link>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-white shadow-sm border border-slate-100/80">
          <p className="text-sm font-medium text-gray-700 mb-2">Ver resultados en</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await fetch(`${API_BASE}/me/active-search`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ searchId: id }),
                });
                router.push('/feed');
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Modo Match
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch(`${API_BASE}/me/active-search`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ searchId: id }),
                });
                router.push('/feed/list');
              }}
              className="px-3 py-2 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200"
            >
              Modo lista
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((card) =>
            card?.id ? (
              <div
                key={card.id}
                className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
              >
                {(listingsStatus[card.id]?.inLists?.length ?? 0) > 0 && (
                  <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-slate-50/80">
                    {(listingsStatus[card.id]?.inLists ?? []).map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium"
                      >
                        📁 {l.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveFromList(l.id, card.id);
                          }}
                          className="ml-0.5 hover:bg-emerald-200 rounded p-0.5"
                          aria-label={`Quitar de ${l.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Link
                  href={`/listing/${card.id}`}
                  className="block hover:bg-slate-50/50 transition-colors"
                >
                  <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden relative group">
                    <ListingCardImageCarousel
                      heroImageUrl={card.heroImageUrl}
                      media={card.media}
                      alt={card.title ?? ''}
                    />
                  </div>
                  <div className="p-3">
                    <h2 className="font-medium truncate">{card.title ?? 'Sin título'}</h2>
                    <p className="text-sm text-gray-600">
                      {card.price != null
                        ? formatListingPrice(card.price, card.currency)
                        : 'Consultar'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{card.locationText ?? ''}</p>
                  </div>
                </Link>
                <div className="px-3 pb-3 flex gap-2 items-center flex-wrap border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(card.id)}
                    className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                      listingsStatus[card.id]?.inLike
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={listingsStatus[card.id]?.inLike ? 'En like' : 'Agregar a like'}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(card.id)}
                    className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                      listingsStatus[card.id]?.inFavorite
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                    title={
                      listingsStatus[card.id]?.inFavorite ? 'En favoritos' : 'Agregar a favoritos'
                    }
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAgregarALista(card)}
                    className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    + Lista
                  </button>
                  {listingsStatus[card.id]?.lead ? (
                    <div className="flex-1 flex items-center gap-1">
                      <span
                        className={`flex-1 py-2 text-center text-sm rounded-xl font-medium ${
                          listingsStatus[card.id]?.lead?.status === 'ACTIVE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        ✓{' '}
                        {listingsStatus[card.id]?.lead?.status === 'ACTIVE'
                          ? 'Esperando respuesta'
                          : 'Consulta enviada'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInquiryListingId(card.id)}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                        title="Enviar otra consulta"
                      >
                        ✉️
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInquiryListingId(card.id)}
                      className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
                    >
                      Quiero que me contacten
                    </button>
                  )}
                </div>
              </div>
            ) : null
          )}
        </div>

        {addToListCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
              <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveToList(addToListCard.id)}
                  className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 text-left"
                >
                  👍 Mis like
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveToList(addToListCard.id)}
                  className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 text-left"
                >
                  ★ Mis favoritos
                </button>
                {customLists.length > 0 && (
                  <div className="border-t border-slate-200 pt-3 mt-1">
                    <p className="text-xs text-slate-700 font-medium mb-2">
                      O guardar en lista existente
                    </p>
                    <div className="flex flex-col gap-1">
                      {customLists.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleAddToCustomList(l.id)}
                          className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 text-left"
                        >
                          📁 {l.name} ({l.count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 mt-1">
                  <p className="text-xs text-slate-800 font-semibold mb-2">O crear nueva lista</p>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="Ej: galpones en Rosario"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2"
                  />
                  <button
                    type="button"
                    onClick={handleNuevaListaSubmit}
                    className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200"
                  >
                    Crear y agregar
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddToListCard(null);
                  setNewListName('');
                }}
                className="mt-4 w-full py-2 text-slate-700 text-sm hover:text-slate-900 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {inquiryListingId && (
          <InquiryModal
            open={!!inquiryListingId}
            onClose={() => setInquiryListingId(null)}
            listingId={inquiryListingId}
            source="LIST"
            onSent={() => handleConsultaSent(inquiryListingId)}
          />
        )}

        {nextCursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2 mt-4 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </button>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-8 space-y-2">
            <p className="text-gray-500">0 resultados ahora con estos filtros.</p>
            <p className="text-sm text-gray-600">
              Te avisamos cuando aparezca algo que matchee. Activá las alertas arriba.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
