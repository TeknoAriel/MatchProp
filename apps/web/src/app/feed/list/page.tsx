'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FixedSizeList as List } from 'react-window';
import type { ListingCard } from '@matchprop/shared';
import ActiveSearchBar from '../../../components/ActiveSearchBar';
import { SkeletonList } from '../../../components/SkeletonLoader';
import FilterChips from '../../../components/FilterChips';
import InquiryModal from '../../../components/InquiryModal';
import PlanErrorBlock from '../../../components/PlanErrorBlock';
import ShareModal from '../../../components/ShareModal';
import ListingCardImageCarousel from '../../../components/ListingCardImageCarousel';
import { recordEngagement } from '../../../lib/userEngagementClient';
import { ACTIVE_SEARCH_CHANGED_EVENT } from '../../../lib/activeSearchEvents';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

type ListingCardWithMedia = ListingCard & {
  media?: { url: string; sortOrder: number }[];
};

/** Normaliza un item del feed para evitar undefined/null que rompan la UI (listados). */
function normalizeCard(raw: unknown): ListingCardWithMedia | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  if (!id) return null;
  const media: { url: string; sortOrder: number }[] | undefined = Array.isArray(c.media)
    ? c.media
        .map((m) => {
          if (!m || typeof m !== 'object') return null;
          const mm = m as Record<string, unknown>;
          const url = typeof mm.url === 'string' && mm.url ? mm.url : null;
          const sortOrder = typeof mm.sortOrder === 'number' ? mm.sortOrder : 0;
          if (!url) return null;
          return { url, sortOrder };
        })
        .filter((x): x is { url: string; sortOrder: number } => x !== null)
    : undefined;
  return {
    id,
    title: typeof c.title === 'string' ? c.title : null,
    price: typeof c.price === 'number' ? c.price : null,
    currency: typeof c.currency === 'string' ? c.currency : null,
    bedrooms: typeof c.bedrooms === 'number' ? c.bedrooms : null,
    bathrooms: typeof c.bathrooms === 'number' ? c.bathrooms : null,
    areaTotal: typeof c.areaTotal === 'number' ? c.areaTotal : null,
    locationText: typeof c.locationText === 'string' ? c.locationText : null,
    heroImageUrl: typeof c.heroImageUrl === 'string' && c.heroImageUrl ? c.heroImageUrl : null,
    media: media?.length ? media.sort((a, b) => a.sortOrder - b.sortOrder) : undefined,
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'API_PARTNER_1',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
  };
}

function normalizeItems(raw: unknown): ListingCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCard).filter((c): c is ListingCard => c !== null);
}

function FeedListPageContent() {
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addToListCard, setAddToListCard] = useState<ListingCard | null>(null);
  const [newListName, setNewListName] = useState('');
  const [addToListLoading, setAddToListLoading] = useState(false);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);
  const [shareListOpen, setShareListOpen] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [shareListContact, setShareListContact] = useState<{
    contactName?: string;
    contactOrg?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
  }>({});
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [hasActiveSearch, setHasActiveSearch] = useState<boolean | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [usedFeedAll, setUsedFeedAll] = useState(false);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string | null>(null);
  const [operationFilter, setOperationFilter] = useState<'SALE' | 'RENT' | null>(null);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedAllFromUrl = searchParams?.get('feed') === 'all';
  const isDemoMode = false;

  const syncActiveSearchFlag = useCallback(() => {
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search: unknown }) => setHasActiveSearch(data.search != null))
      .catch(() => setHasActiveSearch(false));
  }, []);

  useEffect(() => {
    syncActiveSearchFlag();
  }, [syncActiveSearchFlag]);

  useEffect(() => {
    const onChange = () => syncActiveSearchFlag();
    window.addEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onChange);
  }, [syncActiveSearchFlag]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/me`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([me, profile]) => {
        const premiumUntil = me?.premiumUntil;
        setIsPremium(!!(premiumUntil && new Date(premiumUntil) > new Date()));
        const name =
          [profile?.profile?.firstName, profile?.profile?.lastName].filter(Boolean).join(' ') ||
          undefined;
        const org =
          profile?.organization?.name || profile?.organization?.commercialName || undefined;
        setShareListContact({
          contactName: name || undefined,
          contactOrg: org || undefined,
          contactWhatsapp: profile?.profile?.whatsapp || undefined,
          contactEmail: me?.email || undefined,
        });
      })
      .catch(() => {});
  }, []);

  const fetchFeed = useCallback(
    async (
      cursor?: string | null,
      feedAll?: boolean,
      includeTotal?: boolean,
      propType?: string | null,
      operation?: 'SALE' | 'RENT' | null
    ) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      if (feedAll) params.set('feed', 'all');
      if (includeTotal) params.set('includeTotal', '1');
      if (propType) params.set('propertyTypes', propType);
      if (operation) params.set('operationType', operation);
      const res = await fetch(`${API_BASE}/feed?${params}`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    [router]
  );

  /** Sin búsqueda activa: mostrar todo (feed=all) para que "Ver en lista" funcione. */
  const useFeedAll = feedAllFromUrl || hasActiveSearch === false;

  useEffect(() => {
    setFetchError(null);
    fetchFeed(null, useFeedAll, true, propertyTypeFilter, operationFilter)
      .then(async (data) => {
        if (data) {
          const items = normalizeItems(data.items);
          setItems(items);
          setNextCursor(
            data.nextCursor != null && typeof data.nextCursor === 'string' ? data.nextCursor : null
          );
          if (data.total != null) setTotalListings(data.total);
          if (useFeedAll && (data.items?.length ?? 0) > 0) setUsedFeedAll(true);
          let globalTotal = data.total ?? 0;
          if (items.length === 0) {
            try {
              const countRes = await fetch(`${API_BASE}/status/listings-count`, {
                credentials: 'include',
              });
              if (countRes.ok) {
                const countData = await countRes.json();
                globalTotal = countData.total ?? 0;
                setTotalListings(globalTotal);
              }
            } catch {
              /* ignore */
            }
          }
          if (items.length === 0 && !useFeedAll) {
            const fallback = await fetchFeed(
              null,
              true,
              false,
              propertyTypeFilter,
              operationFilter
            );
            if (fallback?.items?.length) {
              setItems(normalizeItems(fallback.items));
              setNextCursor(
                fallback.nextCursor != null && typeof fallback.nextCursor === 'string'
                  ? fallback.nextCursor
                  : null
              );
              setUsedFeedAll(true);
            }
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setFetchError('No se pudo cargar el feed.');
        setLoading(false);
      });
  }, [fetchFeed, useFeedAll, propertyTypeFilter, operationFilter]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchFeed(
      nextCursor,
      usedFeedAll,
      false,
      propertyTypeFilter,
      operationFilter
    );
    if (data?.items?.length) {
      const next = normalizeItems(data.items);
      setItems((prev) => [...prev, ...next]);
      setNextCursor(
        data.nextCursor != null && typeof data.nextCursor === 'string' ? data.nextCursor : null
      );
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    const ids = items.filter((c) => c.id).map((c) => c.id);
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
        if (!isDemoMode) router.replace('/login');
        return;
      }
      if (res.ok) {
        recordEngagement('save');
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
      const msg =
        (err as { message?: string })?.message ||
        (res.status === 403 ? 'Necesitás ser premium para guardar.' : 'Error al guardar');
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    } catch {
      const msg = 'Error al guardar. Revisá la conexión.';
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
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
        if (!isDemoMode) router.replace('/login');
        return;
      }
      if (res.ok) {
        recordEngagement('save');
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
      const msg =
        (err as { message?: string })?.message ||
        (res.status === 403
          ? 'Necesitás ser premium para listas personalizadas.'
          : 'Error al agregar');
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    } catch {
      const msg = 'Error al agregar. Revisá la conexión.';
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAddToListLoading(false);
    }
  }

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
      if (!inLike) recordEngagement('save');
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
      if (!inFav) recordEngagement('save');
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

  async function handleNuevaListaSubmit() {
    if (!addToListCard || addToListLoading) return;
    const name = newListName.trim();
    setAddToListError(null);
    setAddToListLoading(true);
    if (!name) {
      setToast('Escribí un nombre para la lista');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    try {
      const createRes = await fetch(`${API_BASE}/me/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (createRes.status === 401) {
        if (!isDemoMode) router.replace('/login');
        return;
      }
      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        const msg = (errBody as { message?: string })?.message;
        throw new Error(
          msg ||
            'Necesitás plan Agente o superior para crear listas. Solo podés usar Like y Favoritos.'
        );
      }
      const list = (await createRes.json()) as { id: string };
      const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId: addToListCard.id }),
      });
      if (!addRes.ok) {
        const errAdd = await addRes.json().catch(() => ({}));
        throw new Error((errAdd as { message?: string })?.message || 'Error al agregar');
      }
      if (addToListCard) {
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
      }
      setToast(`Lista "${name}" creada y propiedad agregada`);
      setTimeout(() => setToast(null), 2500);
      setAddToListCard(null);
      setNewListName('');
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Necesitás plan Agente o superior para crear listas.';
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setAddToListLoading(false);
    }
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

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="w-full space-y-4">
          <div className="h-8 bg-slate-200 rounded animate-pulse w-1/3" />
          <SkeletonList count={4} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--mp-bg)]">
      <div className="-mx-4 md:-mx-6 shrink-0">
        <ActiveSearchBar />
      </div>
      <div className="w-full">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mp-muted)] mb-1">
              Comparar en contexto
            </p>
            <h1 className="text-xl font-bold text-[var(--mp-foreground)] tracking-tight">Lista</h1>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (isPremium === false) {
                  setToast('Necesitás ser premium para compartir listas.');
                  setTimeout(() => setToast(null), 4000);
                  return;
                }
                setShareListOpen(true);
              }}
              className="text-xs font-medium text-[var(--mp-muted)] hover:text-[var(--mp-accent)] underline underline-offset-2"
            >
              Compartir esta vista
            </button>
          )}
        </div>

        {hasActiveSearch === false && (
          <div className="mb-3 p-3 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] text-sm text-[var(--mp-muted)]">
            Definí qué buscás para ver solo lo que te interesa.{' '}
            <Link href="/dashboard" className="text-[var(--mp-accent)] font-medium hover:underline">
              Buscar
            </Link>
          </div>
        )}

        {!loading && (
          <div className="mb-3">
            <FilterChips
              operationFilter={operationFilter}
              propertyTypeFilter={propertyTypeFilter}
              onOperationChange={setOperationFilter}
              onPropertyTypeChange={setPropertyTypeFilter}
              disabled={loading}
            />
          </div>
        )}

        {shareListOpen && items.length > 0 && (
          <ShareModal
            open={shareListOpen}
            onClose={() => setShareListOpen(false)}
            url={
              typeof window !== 'undefined'
                ? `${window.location.origin}/listas/share?ids=${items.map((i) => i.id).join(',')}`
                : ''
            }
            title={`${items.length} propiedades - ${PRODUCT_NAME}`}
            contactName={shareListContact.contactName}
            contactOrg={shareListContact.contactOrg}
            contactWhatsapp={shareListContact.contactWhatsapp}
            contactEmail={shareListContact.contactEmail}
          />
        )}

        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">
            {fetchError}
          </div>
        )}
        {toast && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg text-sm">{toast}</div>
        )}
        {items.length === 0 ? (
          <div className="text-center py-12">
            {totalListings === 0 ? (
              <>
                <p className="text-gray-500 text-lg">No hay propiedades cargadas aún.</p>
                <p className="text-gray-400 text-sm mt-2">
                  {typeof window !== 'undefined' &&
                  (window.location.hostname.includes('vercel.app') ||
                    window.location.hostname !== 'localhost')
                    ? 'Pronto habrá listados disponibles. Usá Buscar para definir tu búsqueda.'
                    : 'En local: ejecutá start (dev-up) para cargar datos.'}
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white"
                >
                  Ir a Buscar
                </Link>
              </>
            ) : !usedFeedAll ? (
              <>
                <p className="text-gray-500 text-lg">No hay resultados para tu búsqueda.</p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    const data = await fetchFeed(
                      null,
                      true,
                      false,
                      propertyTypeFilter,
                      operationFilter
                    );
                    if (data) {
                      setItems(normalizeItems(data.items));
                      setNextCursor(
                        data.nextCursor != null && typeof data.nextCursor === 'string'
                          ? data.nextCursor
                          : null
                      );
                      setUsedFeedAll(true);
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Ver todo / Ver similares
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-lg">No hay propiedades cargadas.</p>
                <p className="text-gray-400 text-sm mt-2">
                  {typeof window !== 'undefined' &&
                  (window.location.hostname.includes('vercel.app') ||
                    window.location.hostname !== 'localhost')
                    ? 'Definí tu búsqueda para ver resultados.'
                    : 'En local: ejecutá demo:data o ingest:run para cargar datos.'}
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white"
                >
                  Buscar
                </Link>
              </>
            )}
          </div>
        ) : items.length > 30 ? (
          <>
            <div className="mb-4 text-sm text-slate-500">
              {items.length} propiedades — scroll fluido (virtualización)
            </div>
            <div className="rounded-xl overflow-hidden" style={{ height: 600 }}>
              <List
                height={600}
                itemCount={items.length}
                itemSize={340}
                width="100%"
                overscanCount={3}
              >
                {({ index, style }) => {
                  const card = items[index]!;
                  const hasValidId =
                    card.id != null &&
                    card.id !== '' &&
                    card.id !== 'undefined' &&
                    card.id !== 'null';
                  const inLists = listingsStatus[card.id]?.inLists ?? [];
                  const CardContent = (
                    <>
                      <div className="aspect-[16/10] bg-gray-200 relative overflow-hidden group">
                        {inLists.length > 0 && (
                          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%] z-10">
                            {inLists.map((l) => (
                              <span
                                key={l.id}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-xs font-medium shadow"
                              >
                                📁 {l.name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveFromList(l.id, card.id);
                                  }}
                                  className="ml-0.5 hover:bg-white/20 rounded p-0.5 leading-none"
                                  aria-label={`Quitar de ${l.name}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <ListingCardImageCarousel
                          heroImageUrl={card.heroImageUrl}
                          media={(card as ListingCardWithMedia).media}
                          alt={card.title ?? ''}
                        />
                      </div>
                      <div className="p-3">
                        <h2 className="font-semibold truncate">{card.title ?? 'Sin título'}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-sm font-medium text-gray-800">
                            {card.price != null
                              ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                              : 'Consultar'}
                          </span>
                          {card.bedrooms != null && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {card.bedrooms} amb
                            </span>
                          )}
                          {card.bathrooms != null && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {card.bathrooms} baños
                            </span>
                          )}
                          {card.locationText && (
                            <span className="text-xs text-gray-500 truncate max-w-[180px]">
                              {card.locationText}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  );
                  return (
                    <div key={card.id} style={style} className="pb-4">
                      <div className="block card-base overflow-hidden card-hover">
                        {hasValidId ? (
                          <Link href={`/listing/${card.id}`} className="block">
                            {CardContent}
                          </Link>
                        ) : (
                          <div className="block">{CardContent}</div>
                        )}
                        {hasValidId && (
                          <div className="px-3 pb-3 flex gap-2 items-center flex-wrap">
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
                              className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                                    e.stopPropagation();
                                    setInquiryListingId(card.id);
                                  }}
                                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm"
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
                                  e.stopPropagation();
                                  setInquiryListingId(card.id);
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                              >
                                Quiero que me contacten
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              </List>
            </div>

            {addToListCard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[90vh] overflow-auto">
                  <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
                  {addToListError && <PlanErrorBlock message={addToListError} className="mb-3" />}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={() => handleSaveToList(addToListCard.id, 'LATER')}
                      className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 transition-colors text-left disabled:opacity-50"
                    >
                      👍 Mis like
                    </button>
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={() => handleSaveToList(addToListCard.id, 'FAVORITE')}
                      className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 transition-colors text-left disabled:opacity-50"
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
                              disabled={addToListLoading}
                              onClick={() => handleAddToCustomList(l.id)}
                              className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 transition-colors text-left disabled:opacity-50"
                            >
                              📁 {l.name} ({l.count})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 mt-1">
                      <p className="text-xs text-slate-800 font-semibold mb-2">
                        O crear nueva lista
                      </p>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Ej: galpones en Rosario"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        disabled={addToListLoading}
                        onClick={handleNuevaListaSubmit}
                        className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {addToListLoading ? 'Guardando...' : 'Crear y agregar'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInquiryListingId(addToListCard.id);
                        setAddToListCard(null);
                      }}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                      Quiero que me contacten
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch(
                            `${API_BASE}/me/saved/${addToListCard.id}?listType=FAVORITE`,
                            { method: 'DELETE', credentials: 'include' }
                          );
                          setToast('Quitado de favoritos');
                          setTimeout(() => setToast(null), 2500);
                        } catch {
                          setToast('Error al quitar');
                          setTimeout(() => setToast(null), 2000);
                        }
                        setAddToListCard(null);
                      }}
                      className="w-full py-2 text-slate-700 text-sm hover:text-slate-900 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      Quitar de esta lista
                    </button>
                  </div>
                </div>
              </div>
            )}

            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 mt-6 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
              >
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
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
          </>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((card, index) => {
                const hasValidId =
                  card.id != null &&
                  card.id !== '' &&
                  card.id !== 'undefined' &&
                  card.id !== 'null';
                const inLists = listingsStatus[card.id]?.inLists ?? [];
                const CardContent = (
                  <>
                    <div className="aspect-[16/10] bg-gray-200 relative overflow-hidden group">
                      {inLists.length > 0 && (
                        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%] z-10">
                          {inLists.map((l) => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-xs font-medium shadow"
                            >
                              📁 {l.name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveFromList(l.id, card.id);
                                }}
                                className="ml-0.5 hover:bg-white/20 rounded p-0.5 leading-none"
                                aria-label={`Quitar de ${l.name}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <ListingCardImageCarousel
                        heroImageUrl={card.heroImageUrl}
                        media={(card as ListingCardWithMedia).media}
                        alt={card.title ?? ''}
                      />
                    </div>
                    <div className="p-3">
                      <h2 className="font-semibold truncate">{card.title ?? 'Sin título'}</h2>
                      {!hasValidId && process.env.NODE_ENV === 'development' && (
                        <span className="text-xs text-amber-600">(sin id)</span>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-sm font-medium text-gray-800">
                          {card.price != null
                            ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                            : 'Consultar'}
                        </span>
                        {card.bedrooms != null && (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {card.bedrooms} amb
                          </span>
                        )}
                        {card.bathrooms != null && (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {card.bathrooms} baños
                          </span>
                        )}
                        {card.locationText && (
                          <span className="text-xs text-gray-500 truncate max-w-[180px]">
                            {card.locationText}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
                return (
                  <div
                    key={hasValidId ? card.id : `no-id-${index}`}
                    className="block card-base overflow-hidden card-hover"
                  >
                    {hasValidId ? (
                      <Link href={`/listing/${card.id}`} className="block">
                        {CardContent}
                      </Link>
                    ) : (
                      <div className="block">{CardContent}</div>
                    )}
                    {hasValidId && (
                      <div className="px-3 pb-3 flex gap-2 items-center flex-wrap">
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
                          className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          + Lista
                        </button>
                        {listingsStatus[card.id]?.lead ? (
                          <div className="flex-1 flex items-center gap-1">
                            <span
                              className={`flex-1 py-2 text-center text-sm rounded-lg font-medium ${
                                listingsStatus[card.id]?.lead?.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
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
                                e.stopPropagation();
                                setInquiryListingId(card.id);
                              }}
                              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm"
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
                              e.stopPropagation();
                              setInquiryListingId(card.id);
                            }}
                            className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                          >
                            Quiero que me contacten
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {addToListCard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[90vh] overflow-auto">
                  <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
                  {addToListError && <PlanErrorBlock message={addToListError} className="mb-3" />}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={() => handleSaveToList(addToListCard.id, 'LATER')}
                      className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 transition-colors text-left disabled:opacity-50"
                    >
                      👍 Mis like
                    </button>
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={() => handleSaveToList(addToListCard.id, 'FAVORITE')}
                      className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 transition-colors text-left disabled:opacity-50"
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
                              disabled={addToListLoading}
                              onClick={() => handleAddToCustomList(l.id)}
                              className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 transition-colors text-left disabled:opacity-50"
                            >
                              📁 {l.name} ({l.count})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 mt-1">
                      <p className="text-xs text-slate-800 font-semibold mb-2">
                        O crear nueva lista
                      </p>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Ej: galpones en Rosario"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        disabled={addToListLoading}
                        onClick={handleNuevaListaSubmit}
                        className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {addToListLoading ? 'Guardando...' : 'Crear y agregar'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInquiryListingId(addToListCard.id);
                        setAddToListCard(null);
                      }}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                      Quiero que me contacten
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch(
                            `${API_BASE}/me/saved/${addToListCard.id}?listType=FAVORITE`,
                            { method: 'DELETE', credentials: 'include' }
                          );
                          setToast('Quitado de favoritos');
                          setTimeout(() => setToast(null), 2500);
                        } catch {
                          setToast('Error al quitar');
                          setTimeout(() => setToast(null), 2000);
                        }
                        setAddToListCard(null);
                      }}
                      className="w-full py-2 text-slate-700 text-sm hover:text-slate-900 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      Quitar de esta lista
                    </button>
                  </div>
                </div>
              </div>
            )}

            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 mt-6 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
              >
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
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
          </>
        )}
      </div>
    </main>
  );
}

export default function FeedListPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="h-32 w-full max-w-2xl bg-slate-200 rounded-xl animate-pulse" />
        </main>
      }
    >
      <FeedListPageContent />
    </Suspense>
  );
}
