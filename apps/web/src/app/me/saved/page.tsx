'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SkeletonList } from '../../../components/SkeletonLoader';
import ListingCardMini, {
  type ListingCardMiniData,
  type ListingStatus,
} from '../../../components/ListingCardMini';
import ShareModal from '../../../components/ShareModal';
import InquiryModal from '../../../components/InquiryModal';
import BetaPremiumBanner from '../../../components/BetaPremiumBanner';

const API_BASE = '/api';

interface CustomList {
  id: string;
  name: string;
  count: number;
}

interface SavedItemRaw {
  id: string;
  listingId: string;
  listType: string;
  listing?: {
    id?: string;
    title?: string | null;
    price?: number | null;
    currency?: string | null;
    locationText?: string | null;
    heroImageUrl?: string | null;
    media?: { url: string; sortOrder: number }[];
    source?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
    areaTotal?: number | null;
    propertyType?: string | null;
    operationType?: string | null;
  } | null;
}

function toListingCardMini(item: SavedItemRaw): ListingCardMiniData | null {
  const listing = item.listing;
  const listingId = item.listingId;
  if (!listing && !listingId) return null;
  return {
    id: listing?.id ?? listingId,
    title: listing?.title ?? null,
    price: listing?.price ?? null,
    currency: listing?.currency ?? null,
    locationText: listing?.locationText ?? null,
    heroImageUrl: listing?.heroImageUrl ?? null,
    media: listing?.media ?? undefined,
    bedrooms: listing?.bedrooms ?? null,
    bathrooms: listing?.bathrooms ?? null,
    areaTotal: listing?.areaTotal ?? null,
    propertyType: listing?.propertyType ?? null,
    operationType: listing?.operationType ?? null,
  };
}

type TabType = 'FAVORITE' | 'LATER' | { listId: string; name: string };

interface SavedSearchItem {
  id: string;
  name: string;
  filters?: Record<string, unknown>;
}

function SavedPageContent() {
  const [items, setItems] = useState<SavedItemRaw[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get('tab');
  const listIdFromUrl = searchParams?.get('listId');
  const [activeTab, setActiveTab] = useState<TabType>(
    listIdFromUrl && searchParams?.get('name')
      ? { listId: listIdFromUrl, name: searchParams.get('name') ?? '' }
      : tabFromUrl === 'like'
        ? 'LATER'
        : 'FAVORITE'
  );
  const [searchModal, setSearchModal] = useState<{ id: string; name: string } | null>(null);
  const [listingsStatus, setListingsStatus] = useState<Record<string, ListingStatus>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareContact, setShareContact] = useState<{
    contactName?: string;
    contactOrg?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
  }>({});
  const [addToListCard, setAddToListCard] = useState<ListingCardMiniData | null>(null);
  const [newListName, setNewListName] = useState('');
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);

  useEffect(() => {
    if (listIdFromUrl && searchParams?.get('name')) {
      setActiveTab({ listId: listIdFromUrl, name: searchParams.get('name') ?? '' });
    } else if (tabFromUrl === 'like') {
      setActiveTab('LATER');
    } else if (tabFromUrl === 'favoritos' || !tabFromUrl) {
      setActiveTab('FAVORITE');
    }
  }, [tabFromUrl, listIdFromUrl, searchParams]);

  const fetchCustomLists = useCallback(() => {
    fetch(`${API_BASE}/me/lists`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data: { lists?: CustomList[] }) => setCustomLists(data?.lists ?? []))
      .catch(() => setCustomLists([]));
  }, []);

  const fetchSavedSearches = useCallback(() => {
    fetch(`${API_BASE}/searches`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => setSavedSearches(Array.isArray(data) ? data : []))
      .catch(() => setSavedSearches([]));
  }, []);

  async function handleCargarSearch(searchId: string, view: 'match' | 'list') {
    setLoadingSearch(searchId);
    try {
      const res = await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId }),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) router.push(view === 'list' ? '/feed/list' : '/feed');
    } finally {
      setLoadingSearch(null);
    }
  }

  const fetchSaved = useCallback(() => {
    setLoading(true);
    const isCustomList = typeof activeTab === 'object' && 'listId' in activeTab;
    const listType = activeTab === 'LATER' ? 'LATER' : activeTab === 'FAVORITE' ? 'FAVORITE' : null;
    const url = isCustomList
      ? `${API_BASE}/me/lists/${activeTab.listId}/items`
      : listType != null
        ? `${API_BASE}/me/saved?listType=${listType}`
        : `${API_BASE}/me/saved?listType=FAVORITE`;
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data === null) {
          setItems([]);
        } else {
          const raw = isCustomList ? (data?.items ?? []) : (data?.items ?? []);
          setItems(Array.isArray(raw) ? raw : []);
        }
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [router, activeTab]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/me`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([me, profile]) => {
        const name =
          [profile?.profile?.firstName, profile?.profile?.lastName].filter(Boolean).join(' ') ||
          undefined;
        const org =
          profile?.organization?.name || profile?.organization?.commercialName || undefined;
        setShareContact({
          contactName: name || undefined,
          contactOrg: org || undefined,
          contactWhatsapp: profile?.profile?.whatsapp || undefined,
          contactEmail: me?.email || undefined,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCustomLists();
  }, [fetchCustomLists]);

  useEffect(() => {
    if (activeTab === 'FAVORITE' || activeTab === 'LATER') fetchSavedSearches();
  }, [activeTab, fetchSavedSearches]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  useEffect(() => {
    const ids = items.map((i) => i.listingId).filter(Boolean);
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

  async function handleToggleFavorite(listingId: string) {
    const s = listingsStatus[listingId];
    const inFav = s?.inFavorite ?? false;
    try {
      if (inFav) {
        const res = await fetch(`${API_BASE}/me/saved/${listingId}?listType=FAVORITE`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status === 401) router.replace('/login');
        else if (res.ok) {
          setItems((prev) => prev.filter((i) => i.listingId !== listingId));
          setListingsStatus((p) => {
            const next = { ...p };
            if (next[listingId]) next[listingId] = { ...next[listingId], inFavorite: false };
            return next;
          });
        }
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
        });
        if (res.status === 401) router.replace('/login');
        else if (res.ok) {
          setListingsStatus((p) => ({
            ...p,
            [listingId]: {
              ...(p[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: true,
            },
          }));
          setToast('Agregado a favoritos');
          setTimeout(() => setToast(null), 2500);
        }
      }
    } catch {
      setToast('Error al actualizar');
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function handleToggleLike(listingId: string) {
    const s = listingsStatus[listingId];
    const inLike = s?.inLike ?? false;
    try {
      if (inLike) {
        const res = await fetch(`${API_BASE}/me/saved/${listingId}?listType=LATER`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status === 401) router.replace('/login');
        else if (res.ok) {
          setItems((prev) => prev.filter((i) => i.listingId !== listingId));
          setListingsStatus((p) => ({
            ...p,
            [listingId]: {
              ...(p[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
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
        if (res.status === 401) router.replace('/login');
        else if (res.ok) {
          setListingsStatus((p) => ({
            ...p,
            [listingId]: {
              ...(p[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inLike: true,
            },
          }));
          setToast('Agregado a like');
          setTimeout(() => setToast(null), 2500);
        }
      }
    } catch {
      setToast('Error al actualizar');
      setTimeout(() => setToast(null), 2000);
    }
  }

  useEffect(() => {
    const onRefocus = () => {
      fetchSaved();
      fetchCustomLists();
    };
    document.addEventListener('visibilitychange', onRefocus);
    window.addEventListener('focus', onRefocus);
    return () => {
      document.removeEventListener('visibilitychange', onRefocus);
      window.removeEventListener('focus', onRefocus);
    };
  }, [fetchSaved, fetchCustomLists]);

  async function handleQuitar(listingId: string) {
    if (removingId) return;
    setRemovingId(listingId);
    try {
      const isCustomList = typeof activeTab === 'object' && 'listId' in activeTab;
      const listTypeParam = activeTab === 'LATER' ? 'LATER' : 'FAVORITE';
      const url = isCustomList
        ? `${API_BASE}/me/lists/${activeTab.listId}/items/${listingId}`
        : `${API_BASE}/me/saved/${listingId}?listType=${listTypeParam}`;
      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        setItems((prev) => prev.filter((i) => i.listingId !== listingId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="h-8 bg-slate-200 rounded animate-pulse w-1/3" />
          <SkeletonList count={3} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <Link href="/feed" className="text-sm font-medium text-blue-600 hover:underline mb-6 block">
          ← Match
        </Link>
        {toast && (
          <div className="mb-4 p-3 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-medium">
            {toast}
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Listas favoritas</h1>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchCustomLists();
              fetchSaved();
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Actualizar
          </button>
        </div>

        <BetaPremiumBanner className="mb-4" />

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('LATER')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'LATER'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            👍 Like
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FAVORITE')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'FAVORITE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ★ Favoritos
          </button>
          {customLists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveTab({ listId: l.id, name: l.name })}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                typeof activeTab === 'object' && activeTab.listId === l.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              📁 {l.name} ({l.count})
            </button>
          ))}
        </div>

        {(activeTab === 'FAVORITE' || activeTab === 'LATER') && savedSearches.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-blue-800">
                Acceso rápido a búsquedas guardadas
              </p>
              <Link
                href="/searches"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Ver todas →
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedSearches.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSearchModal({ id: s.id, name: s.name })}
                  className="flex gap-1.5 items-center px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-800 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="truncate max-w-[140px]">{s.name}</span>
                  <span className="text-blue-500">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {searchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
              <h3 className="font-bold text-slate-900 mb-2">Ver búsqueda</h3>
              <p className="text-sm text-slate-600 mb-4 truncate">{searchModal.name}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleCargarSearch(searchModal.id, 'match');
                    setSearchModal(null);
                  }}
                  disabled={!!loadingSearch}
                  className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingSearch === searchModal.id ? 'Cargando...' : 'Ver como Match'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCargarSearch(searchModal.id, 'list');
                    setSearchModal(null);
                  }}
                  disabled={!!loadingSearch}
                  className="w-full py-2.5 px-4 bg-slate-100 text-slate-800 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  {loadingSearch === searchModal.id ? 'Cargando...' : 'Ver como lista'}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchModal(null)}
                  className="w-full py-2 text-slate-700 text-sm hover:text-slate-900 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              📤 Compartir lista
            </button>
          </div>
        )}

        {shareOpen && items.length > 0 && (
          <ShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            url={
              typeof window !== 'undefined'
                ? `${window.location.origin}/listas/share?ids=${items.map((i) => i.listingId).join(',')}`
                : ''
            }
            title={`${items.length} propiedades - MatchProp`}
            contactName={shareContact.contactName}
            contactOrg={shareContact.contactOrg}
            contactWhatsapp={shareContact.contactWhatsapp}
            contactEmail={shareContact.contactEmail}
          />
        )}

        {addToListCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
              <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleLike(addToListCard.id);
                    setAddToListCard(null);
                  }}
                  className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 text-left"
                >
                  👍 Mis like
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleFavorite(addToListCard.id);
                    setAddToListCard(null);
                  }}
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
                          onClick={async () => {
                            const res = await fetch(`${API_BASE}/me/lists/${l.id}/items`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ listingId: addToListCard.id }),
                            });
                            if (res.ok) {
                              setListingsStatus((p) => ({
                                ...p,
                                [addToListCard.id]: {
                                  ...(p[addToListCard.id] ?? {
                                    inFavorite: false,
                                    inLike: false,
                                    inLists: [],
                                    lead: null,
                                  }),
                                  inLists: [
                                    ...(p[addToListCard.id]?.inLists ?? []),
                                    { id: l.id, name: l.name },
                                  ],
                                },
                              }));
                              setToast(`Agregado a ${l.name}`);
                              setTimeout(() => setToast(null), 2500);
                              fetchCustomLists();
                            }
                            setAddToListCard(null);
                          }}
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Ej: galpones en Rosario"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const name = newListName.trim();
                        if (!name) return;
                        const res = await fetch(`${API_BASE}/me/lists`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ name }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          await fetch(`${API_BASE}/me/lists/${data.id}/items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ listingId: addToListCard.id }),
                          });
                          setNewListName('');
                          fetchCustomLists();
                          setToast(`Lista "${name}" creada`);
                          setTimeout(() => setToast(null), 2500);
                          setAddToListCard(null);
                        } else {
                          setToast('No podés crear listas (requiere plan Agente o superior)');
                          setTimeout(() => setToast(null), 3000);
                        }
                      }}
                      className="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl text-sm font-medium hover:bg-blue-200"
                    >
                      Crear y agregar
                    </button>
                  </div>
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
            onSent={() => {
              const id = inquiryListingId;
              setListingsStatus((prev) => ({
                ...prev,
                [id]: {
                  inFavorite: prev[id]?.inFavorite ?? false,
                  inLike: prev[id]?.inLike ?? false,
                  inLists: prev[id]?.inLists ?? [],
                  lead: { status: 'PENDING' },
                },
              }));
              setInquiryListingId(null);
            }}
          />
        )}

        {items.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-slate-500">
              {activeTab === 'FAVORITE'
                ? 'No tenés favoritos. Usá ★ o "Agregar a lista favorita" en el feed.'
                : activeTab === 'LATER'
                  ? 'No tenés likes. Usá 👍 o "Agregar a like" en el feed.'
                  : 'No hay propiedades en esta lista. Agregá desde el feed con "Agregar a lista".'}
            </p>
            <Link
              href="/feed"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              Ir al feed
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const card = toListingCardMini(item as SavedItemRaw);
              if (!card) return null;
              const status = listingsStatus[item.listingId];
              return (
                <ListingCardMini
                  key={item.id}
                  listing={card}
                  href={`/listing/${item.listingId}`}
                  showShareButton
                  status={status ?? null}
                  onContact={() => setInquiryListingId(item.listingId)}
                  onRemove={() => handleQuitar(item.listingId)}
                  onToggleFavorite={() => handleToggleFavorite(item.listingId)}
                  onToggleLike={() => handleToggleLike(item.listingId)}
                  onAddToList={() => setAddToListCard(card)}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4">
          <div className="h-32 bg-slate-200 rounded-xl animate-pulse max-w-lg mx-auto" />
        </main>
      }
    >
      <SavedPageContent />
    </Suspense>
  );
}
