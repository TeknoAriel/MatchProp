'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import { getListingImageUrl } from '../../../lib/demo-image';
import InquiryModal from '../../../components/InquiryModal';
import PlanErrorBlock from '../../../components/PlanErrorBlock';
import 'leaflet/dist/leaflet.css';

const API_BASE = '/api';

type MapListingCard = ListingCard & { lat: number; lng: number };

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const DEFAULT_LAT = -34.6037;
const DEFAULT_LNG = -58.3816;
const BBOX_PADDING = 0.08;

function normalizeCard(raw: unknown): MapListingCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  const lat = typeof c.lat === 'number' ? c.lat : null;
  const lng = typeof c.lng === 'number' ? c.lng : null;
  if (!id || lat == null || lng == null) return null;
  return {
    id,
    lat,
    lng,
    title: typeof c.title === 'string' ? c.title : null,
    price: typeof c.price === 'number' ? c.price : null,
    currency: typeof c.currency === 'string' ? c.currency : null,
    bedrooms: typeof c.bedrooms === 'number' ? c.bedrooms : null,
    bathrooms: typeof c.bathrooms === 'number' ? c.bathrooms : null,
    areaTotal: typeof c.areaTotal === 'number' ? c.areaTotal : null,
    locationText: typeof c.locationText === 'string' ? c.locationText : null,
    heroImageUrl: typeof c.heroImageUrl === 'string' && c.heroImageUrl ? c.heroImageUrl : null,
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'API_PARTNER_1',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
  };
}

function normalizeItems(raw: unknown): MapListingCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCard).filter((c): c is MapListingCard => c !== null);
}

const MapView = dynamic(() => import('../../../components/SearchMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] bg-slate-200 animate-pulse flex items-center justify-center text-slate-500">
      Cargando mapa...
    </div>
  ),
});

export default function SearchMapPage() {
  const router = useRouter();
  const [items, setItems] = useState<MapListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
  });
  const [listingsStatus, setListingsStatus] = useState<
    Record<
      string,
      {
        inFavorite: boolean;
        inLike: boolean;
        inLists: { id: string; name: string }[];
        lead: { status: string } | null;
      }
    >
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [addToListCard, setAddToListCard] = useState<ListingCard | null>(null);
  const [newListName, setNewListName] = useState('');
  const [addToListLoading, setAddToListLoading] = useState(false);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);

  const fetchMapItems = useCallback(
    async (b: Bounds | null) => {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (b) {
        params.set('minLat', String(b.minLat));
        params.set('maxLat', String(b.maxLat));
        params.set('minLng', String(b.minLng));
        params.set('maxLng', String(b.maxLng));
      }
      const res = await fetch(`${API_BASE}/feed/map?${params}`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
      if (!res.ok) throw new Error('Error al cargar ubicaciones');
      const data = (await res.json()) as { items?: unknown[] };
      return { items: normalizeItems(data.items ?? []) };
    },
    [router]
  );

  useEffect(() => {
    fetchMapItems(null)
      .then((data) => {
        if (data?.items?.length) {
          setItems(data.items);
          const first = data.items[0]!;
          setCenter({ lat: first.lat, lng: first.lng });
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        setLoading(false);
      });
  }, [fetchMapItems]);

  useEffect(() => {
    const ids = items.map((c) => c.id).filter(Boolean);
    if (ids.length === 0) return;
    fetch(`${API_BASE}/listings/my-status-bulk?ids=${ids.join(',')}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then(
        (data: {
          items?: Record<
            string,
            {
              inFavorite: boolean;
              inLike: boolean;
              inLists: { id: string; name: string }[];
              lead: { status: string } | null;
            }
          >;
        }) => setListingsStatus(data.items ?? {})
      )
      .catch(() => setListingsStatus({}));
  }, [items]);

  const handleBoundsChange = useCallback((b: Bounds) => {
    fetch(
      `${API_BASE}/feed/map?limit=200&minLat=${b.minLat}&maxLat=${b.maxLat}&minLng=${b.minLng}&maxLng=${b.maxLng}`,
      { credentials: 'include' }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: unknown[] } | null) => {
        if (data?.items) setItems(normalizeItems(data.items));
      })
      .catch(() => {});
  }, []);

  async function handleToggleLike(listingId: string) {
    const inLike = listingsStatus[listingId]?.inLike ?? false;
    const url = inLike ? `${API_BASE}/me/saved/${listingId}?listType=LATER` : `${API_BASE}/saved`;
    const opts = inLike
      ? { method: 'DELETE' as const, credentials: 'include' as RequestCredentials }
      : {
          method: 'POST' as const,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' as RequestCredentials,
          body: JSON.stringify({ listingId, listType: 'LATER' }),
        };
    const res = await fetch(url, opts);
    if (res.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [listingId]: {
          inFavorite: prev[listingId]?.inFavorite ?? false,
          inLike: !inLike,
          inLists: prev[listingId]?.inLists ?? [],
          lead: prev[listingId]?.lead ?? null,
        },
      }));
      setToast(inLike ? 'Quitado de like' : 'Agregado a like');
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function handleToggleFavorite(listingId: string) {
    const inFav = listingsStatus[listingId]?.inFavorite ?? false;
    const url = inFav ? `${API_BASE}/me/saved/${listingId}?listType=FAVORITE` : `${API_BASE}/saved`;
    const opts = inFav
      ? { method: 'DELETE' as const, credentials: 'include' as RequestCredentials }
      : {
          method: 'POST' as const,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' as RequestCredentials,
          body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
        };
    const res = await fetch(url, opts);
    if (res.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [listingId]: {
          inFavorite: !inFav,
          inLike: prev[listingId]?.inLike ?? false,
          inLists: prev[listingId]?.inLists ?? [],
          lead: prev[listingId]?.lead ?? null,
        },
      }));
      setToast(inFav ? 'Quitado de favoritos' : 'Agregado a favoritos');
      setTimeout(() => setToast(null), 2000);
    }
  }

  function handleAgregarALista(card: ListingCard) {
    setAddToListCard(card);
    setAddToListError(null);
    fetch(`${API_BASE}/me/lists`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data: { lists?: { id: string; name: string; count: number }[] }) =>
        setCustomLists(data?.lists ?? [])
      )
      .catch(() => setCustomLists([]));
  }

  async function handleSaveToList(listingId: string, listType: 'FAVORITE' | 'LATER') {
    if (addToListLoading) return;
    setAddToListLoading(true);
    setAddToListError(null);
    try {
      const res = await fetch(`${API_BASE}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, listType }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        setListingsStatus((prev) => ({
          ...prev,
          [listingId]: {
            inFavorite: listType === 'FAVORITE' ? true : (prev[listingId]?.inFavorite ?? false),
            inLike: listType === 'LATER' ? true : (prev[listingId]?.inLike ?? false),
            inLists: prev[listingId]?.inLists ?? [],
            lead: prev[listingId]?.lead ?? null,
          },
        }));
        setToast(listType === 'FAVORITE' ? 'Agregado a favoritos' : 'Agregado a like');
        setTimeout(() => setToast(null), 2500);
        setAddToListCard(null);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setAddToListError((err as { message?: string })?.message || 'Error al guardar');
    } finally {
      setAddToListLoading(false);
    }
  }

  async function handleAddToCustomList(listId: string) {
    if (!addToListCard || addToListLoading) return;
    setAddToListLoading(true);
    setAddToListError(null);
    try {
      const res = await fetch(`${API_BASE}/me/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId: addToListCard.id }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        const list = customLists.find((l) => l.id === listId);
        if (addToListCard && list) {
          setListingsStatus((prev) => ({
            ...prev,
            [addToListCard.id]: {
              inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
              inLike: prev[addToListCard.id]?.inLike ?? false,
              inLists: [
                ...(prev[addToListCard.id]?.inLists ?? []),
                { id: list.id, name: list.name },
              ],
              lead: prev[addToListCard.id]?.lead ?? null,
            },
          }));
        }
        setToast(`Agregado a "${list?.name ?? 'lista'}"`);
        setTimeout(() => setToast(null), 2500);
        setAddToListCard(null);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setAddToListError((err as { message?: string })?.message || 'Error al agregar');
    } finally {
      setAddToListLoading(false);
    }
  }

  async function handleRemoveFromList(listId: string, listingId: string) {
    try {
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
            [listingId]: {
              ...cur,
              inLists: cur.inLists.filter((l) => l.id !== listId),
            },
          };
        });
        setToast('Quitado de la lista');
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      setToast('Error al quitar');
      setTimeout(() => setToast(null), 2000);
    }
  }

  function handleNuevaListaSubmit() {
    if (!addToListCard || addToListLoading) return;
    const name = newListName.trim();
    setAddToListError(null);
    setAddToListLoading(true);
    if (!name) {
      setToast('Escribí un nombre para la lista');
      setTimeout(() => setToast(null), 2000);
      setAddToListLoading(false);
      return;
    }
    fetch(`${API_BASE}/me/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    })
      .then((createRes) => {
        if (createRes.status === 401) {
          router.replace('/login');
          return null;
        }
        if (!createRes.ok) return createRes.json().then((err: { message?: string }) => Promise.reject(err));
        return createRes.json() as Promise<{ id: string }>;
      })
      .then(async (list) => {
        if (!list?.id) return Promise.reject(new Error('No list id'));
        const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId: addToListCard!.id }),
        });
        if (!addRes.ok) {
          const err = await addRes.json().catch(() => ({}));
          return Promise.reject(err as { message?: string });
        }
        if (addToListCard) {
          setListingsStatus((prev) => ({
            ...prev,
            [addToListCard.id]: {
              inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
              inLike: prev[addToListCard.id]?.inLike ?? false,
              inLists: [
                ...(prev[addToListCard.id]?.inLists ?? []),
                { id: list.id, name: newListName },
              ],
              lead: prev[addToListCard.id]?.lead ?? null,
            },
          }));
        }
        setToast(`Lista "${newListName}" creada y propiedad agregada`);
        setTimeout(() => setToast(null), 2500);
        setAddToListCard(null);
        setNewListName('');
      })
      .catch((e) => {
        const msg = e?.message || 'Necesitás plan Agente o superior para crear listas.';
        setAddToListError(msg);
      })
      .finally(() => setAddToListLoading(false));
  }

  function handleConsultaSent(listingId: string) {
    setToast('Consulta enviada');
    setTimeout(() => setToast(null), 3000);
    setListingsStatus((prev) => ({
      ...prev,
      [listingId]: {
        inFavorite: prev[listingId]?.inFavorite ?? false,
        inLike: prev[listingId]?.inLike ?? false,
        inLists: prev[listingId]?.inLists ?? [],
        lead: { status: 'PENDING' },
      },
    }));
  }

  const bounds: [[number, number], [number, number]] = useMemo(() => {
    if (items.length > 0) {
      const lats = items.map((p) => p.lat);
      const lngs = items.map((p) => p.lng);
      return [
        [
          Math.min(...lats) - BBOX_PADDING,
          Math.min(...lngs) - BBOX_PADDING,
        ],
        [
          Math.max(...lats) + BBOX_PADDING,
          Math.max(...lngs) + BBOX_PADDING,
        ],
      ];
    }
    return [
      [center.lat - BBOX_PADDING, center.lng - BBOX_PADDING],
      [center.lat + BBOX_PADDING, center.lng + BBOX_PADDING],
    ];
  }, [items, center.lat, center.lng]);

  const displayItems = items.slice(0, 50);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--mp-bg)]">
      <div className="p-4 border-b border-[var(--mp-border)] bg-[var(--mp-card)] flex flex-wrap items-center gap-2">
        <Link href="/search" className="text-sm text-[var(--mp-accent)] hover:underline">
          ← Búsqueda por filtros
        </Link>
        <Link href="/assistant" className="text-sm text-[var(--mp-accent)] hover:underline">
          Asistente
        </Link>
        <Link href="/feed/list" className="text-sm text-[var(--mp-accent)] hover:underline">
          Ver listado
        </Link>
        <h1 className="text-xl font-bold text-[var(--mp-foreground)] w-full mt-2">Buscar por mapa</h1>
        <p className="text-sm text-[var(--mp-muted)] w-full">
          Propiedades con ubicación. En el listado podés guardar en favoritos, like, listas y enviar consulta.
        </p>
      </div>

      {toast && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-[var(--mp-accent)]/20 text-[var(--mp-foreground)] border border-[var(--mp-accent)]/40 text-sm">
          {toast}
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="h-12 w-12 border-4 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 text-red-600 bg-red-50 border-b border-red-200">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="flex-1 min-h-[280px] bg-slate-100 relative">
            <MapView
              items={items.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, title: i.title, price: i.price, locationText: i.locationText }))}
              center={[center.lat, center.lng]}
              bounds={bounds}
              onBoundsChange={handleBoundsChange}
            />
          </div>
          <div className="p-4 border-t border-[var(--mp-border)] bg-[var(--mp-card)] max-h-[45vh] overflow-y-auto">
            <h2 className="font-semibold text-[var(--mp-foreground)] mb-3">
              Propiedades con ubicación ({items.length})
            </h2>
            <ul className="space-y-3">
              {displayItems.length === 0 ? (
                <li className="text-[var(--mp-muted)] text-sm">
                  No hay propiedades con coordenadas en tu búsqueda.
                </li>
              ) : (
                displayItems.map((card) => {
                  const inLists = listingsStatus[card.id]?.inLists ?? [];
                  return (
                    <li
                      key={card.id}
                      className="rounded-2xl border border-[var(--mp-border)] bg-[var(--mp-bg)] overflow-hidden"
                    >
                      <Link href={`/listing/${card.id}`} className="block">
                        <div className="aspect-[16/10] bg-gray-200 relative">
                          {inLists.length > 0 && (
                            <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%] z-10">
                              {inLists.map((l) => (
                                <span
                                  key={l.id}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-xs font-medium"
                                >
                                  📁 {l.name}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveFromList(l.id, card.id);
                                    }}
                                    className="ml-0.5 hover:bg-white/20 rounded p-0.5"
                                    aria-label={`Quitar de ${l.name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {(() => {
                            const imgUrl = getListingImageUrl(card.id, card.heroImageUrl);
                            return imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={card.title ?? ''}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                Sin imagen
                              </div>
                            );
                          })()}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold truncate text-[var(--mp-foreground)]">
                            {card.title ?? 'Sin título'}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-sm font-medium">
                              {card.price != null
                                ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                                : 'Consultar'}
                            </span>
                            {card.bedrooms != null && (
                              <span className="text-xs bg-[var(--mp-bg)] px-2 py-0.5 rounded">
                                {card.bedrooms} amb
                              </span>
                            )}
                            {card.locationText && (
                              <span className="text-xs text-[var(--mp-muted)] truncate max-w-[180px]">
                                {card.locationText}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="px-3 pb-3 flex gap-2 items-center flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(card.id)}
                          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                            listingsStatus[card.id]?.inLike
                              ? 'bg-green-600 text-white'
                              : 'bg-[var(--mp-bg)] text-[var(--mp-muted)] border border-[var(--mp-border)] hover:bg-slate-200'
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
                            listingsStatus[card.id]?.inFavorite
                              ? 'En favoritos'
                              : 'Agregar a favoritos'
                          }
                        >
                          ★
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAgregarALista(card)}
                          className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)] hover:bg-slate-200"
                        >
                          + Lista
                        </button>
                        {listingsStatus[card.id]?.lead ? (
                          <div className="flex-1 flex items-center gap-1">
                            <span
                              className={`flex-1 py-2 text-center text-sm rounded-lg font-medium ${
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
                              onClick={(e) => {
                                e.preventDefault();
                                setInquiryListingId(card.id);
                              }}
                              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                              title="Enviar otra consulta"
                            >
                              ✉️
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setInquiryListingId(card.id);
                            }}
                            className="flex-1 py-2 bg-[var(--mp-accent)] text-white text-sm rounded-lg hover:opacity-90"
                          >
                            Quiero que me contacten
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            {items.length > 50 && (
              <p className="text-sm text-[var(--mp-muted)] mt-2">
                Mostrando 50 de {items.length}. Mové el mapa para afinar la zona.
              </p>
            )}
          </div>
        </>
      )}

      {addToListCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--mp-card)] rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[90vh] overflow-auto border border-[var(--mp-border)]">
            <h3 className="font-bold text-[var(--mp-foreground)] mb-4">Agregar a lista</h3>
            {addToListError && (
              <PlanErrorBlock message={addToListError} className="mb-3" />
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={addToListLoading}
                onClick={() => handleSaveToList(addToListCard.id, 'LATER')}
                className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 text-left disabled:opacity-50"
              >
                👍 Mis like
              </button>
              <button
                type="button"
                disabled={addToListLoading}
                onClick={() => handleSaveToList(addToListCard.id, 'FAVORITE')}
                className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 text-left disabled:opacity-50"
              >
                ★ Mis favoritos
              </button>
              {customLists.length > 0 && (
                <div className="border-t border-[var(--mp-border)] pt-3 mt-1">
                  <p className="text-xs text-[var(--mp-muted)] font-medium mb-2">
                    O guardar en lista existente
                  </p>
                  <div className="flex flex-col gap-1">
                    {customLists.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        disabled={addToListLoading}
                        onClick={() => handleAddToCustomList(l.id)}
                        className="w-full py-2 px-4 bg-[var(--mp-bg)] text-[var(--mp-foreground)] rounded-xl hover:bg-slate-200 text-left disabled:opacity-50"
                      >
                        📁 {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-[var(--mp-border)] pt-3 mt-1">
                <p className="text-xs text-[var(--mp-muted)] mb-2">O crear nueva lista</p>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Nombre de la lista"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-bg)] text-[var(--mp-foreground)] mb-2"
                />
                <button
                  type="button"
                  disabled={addToListLoading || !newListName.trim()}
                  onClick={handleNuevaListaSubmit}
                  className="w-full py-2 px-4 bg-[var(--mp-accent)] text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {addToListLoading ? 'Guardando...' : 'Crear y agregar'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddToListCard(null);
                setAddToListError(null);
              }}
              className="mt-4 w-full py-2 text-[var(--mp-muted)] hover:text-[var(--mp-foreground)]"
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
    </main>
  );
}
