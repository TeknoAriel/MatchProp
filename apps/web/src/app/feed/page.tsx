'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import FilterChips from '../../components/FilterChips';
import InquiryModal from '../../components/InquiryModal';
import PlanErrorBlock from '../../components/PlanErrorBlock';
import SwipeCard from '../../components/SwipeCard';
import { useToast, getRandomMessage } from '../../components/FunToast';
import { useCelebration } from '../../components/Celebration';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';
const SWIPE_DEBOUNCE_MS = 400;

function FeedPageContent() {
  const [queue, setQueue] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastSwiped, setLastSwiped] = useState<{ card: ListingCard; decision: string } | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [swipeDisabled, setSwipeDisabled] = useState(false);
  const { showSuccess } = useToast();
  const { celebrate, CelebrationComponent } = useCelebration();
  const [likeCount, setLikeCount] = useState(0);
  const [addToListCard, setAddToListCard] = useState<ListingCard | null>(null);
  const [newListName, setNewListName] = useState('');
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [hasActiveSearch, setHasActiveSearch] = useState<boolean | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [emptyCatalog, setEmptyCatalog] = useState(false);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string | null>(null);
  const [operationFilter, setOperationFilter] = useState<'SALE' | 'RENT' | null>(null);
  const [usedFeedAll, setUsedFeedAll] = useState(false);
  const [leadSentIds, setLeadSentIds] = useState<Set<string>>(new Set());
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedAllFromUrl = searchParams?.get('feed') === 'all';

  useEffect(() => {
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search: unknown }) => setHasActiveSearch(data.search != null))
      .catch(() => setHasActiveSearch(false));
  }, []);

  const useFeedAll = feedAllFromUrl || hasActiveSearch === false;

  const fetchFeed = useCallback(
    async (
      cursor?: string | null,
      feedAll?: boolean,
      propType?: string | null,
      operation?: 'SALE' | 'RENT' | null
    ) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      if (feedAll) params.set('feed', 'all');
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

  useEffect(() => {
    fetchFeed(null, useFeedAll, propertyTypeFilter, operationFilter)
      .then((data) => {
        if (data) {
          setQueue(data.items ?? []);
          setNextCursor(data.nextCursor ?? null);
          setFallbackUsed(Boolean(data.fallbackUsed));
          setEmptyCatalog(Boolean((data as { emptyCatalog?: boolean }).emptyCatalog));
          if (useFeedAll && (data.items?.length ?? 0) > 0) setUsedFeedAll(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fetchFeed, useFeedAll, propertyTypeFilter, operationFilter]);

  const currentCard = queue[0];

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchFeed(nextCursor, usedFeedAll, propertyTypeFilter, operationFilter);
    if (data?.items?.length) {
      setQueue((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor ?? null);
    }
    setLoadingMore(false);
  }

  function handleSwipe(listingId: string, decision: 'LIKE' | 'NOPE') {
    if (inFlightRef.current.has(listingId) || swipeDisabled) return;
    const card = queue.find((c) => c.id === listingId);
    if (!card) return;

    inFlightRef.current.add(listingId);
    setSwipeDisabled(true);
    setLastSwiped({ card, decision });
    setQueue((prev) => prev.filter((i) => i.id !== listingId));

    // Like = agregar a "Mis like" (LATER) + mostrar feedback divertido
    if (decision === 'LIKE') {
      const newCount = likeCount + 1;
      setLikeCount(newCount);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
      }

      // Cada 5 likes, mostrar celebración de match
      if (newCount % 5 === 0) {
        celebrate('match', {
          title: `¡${newCount} matches! 🔥`,
          subtitle: 'Estás en racha. ¡Seguí así!',
        });
      } else {
        showSuccess(getRandomMessage('saved'), '💚');
      }

      fetch(`${API_BASE}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, listType: 'LATER' }),
      }).catch(() => {});
    }

    fetch(`${API_BASE}/swipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId, decision }),
    })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          return res
            .json()
            .catch(() => ({}))
            .then((body: { message?: string }) => {
              throw new Error(body?.message ?? 'Swipe falló');
            });
        }
      })
      .catch((err) => {
        setQueue((prev) => [card, ...prev]);
        setLastSwiped(null);
        setToast(err instanceof Error ? err.message : 'Error al guardar. Reintentá.');
        setTimeout(() => setToast(null), 3000);
      })
      .finally(() => {
        inFlightRef.current.delete(listingId);
        setTimeout(() => setSwipeDisabled(false), SWIPE_DEBOUNCE_MS);
      });

    if (queue.length <= 1 && nextCursor) loadMore();
  }

  async function handleSaveToList(
    listingId: string,
    listType: 'FAVORITE' | 'LATER',
    opts?: { skipToast?: boolean }
  ): Promise<{ ok: boolean; error?: string }> {
    if (inFlightRef.current.has(listingId) || swipeDisabled)
      return { ok: false, error: 'Esperá un momento' };
    const card = queue.find((c) => c.id === listingId);
    if (!card) return { ok: false, error: 'Propiedad no encontrada' };

    inFlightRef.current.add(listingId);
    setSwipeDisabled(true);
    setLastSwiped({ card, decision: listType });
    setQueue((prev) => prev.filter((i) => i.id !== listingId));

    try {
      const res = await fetch(`${API_BASE}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, listType }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return { ok: false };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { message?: string })?.message ?? 'Error al guardar';
        throw new Error(msg);
      }
      if (!opts?.skipToast) {
        setToast(listType === 'FAVORITE' ? 'Agregado a lista favorita' : 'Agregado a like');
        setTimeout(() => setToast(null), 2500);
      }
      if (queue.length <= 1 && nextCursor) loadMore();
      return { ok: true };
    } catch (err) {
      setQueue((prev) => [card, ...prev]);
      setLastSwiped(null);
      const msg = err instanceof Error ? err.message : 'Error al guardar. Reintentá.';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
      return { ok: false, error: msg };
    } finally {
      inFlightRef.current.delete(listingId);
      setTimeout(() => setSwipeDisabled(false), SWIPE_DEBOUNCE_MS);
    }
  }

  function handleAgregarALista() {
    if (!currentCard) return;
    setAddToListCard(currentCard);
    setNewListName('');
    setAddToListError(null);
    fetch(`${API_BASE}/me/lists`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data: { lists?: { id: string; name: string; count: number }[] }) =>
        setCustomLists(data?.lists ?? [])
      )
      .catch(() => setCustomLists([]));
  }

  const [addToListLoading, setAddToListLoading] = useState(false);
  const [addToListError, setAddToListError] = useState<string | null>(null);

  async function handleAddToCustomList(listId: string) {
    if (!addToListCard || addToListLoading) return;
    setAddToListLoading(true);
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { message?: string })?.message;
        throw new Error(msg || 'Error al agregar');
      }
      const list = customLists.find((l) => l.id === listId);
      setToast(`Agregado a "${list?.name ?? 'lista'}"`);
      setTimeout(() => setToast(null), 2500);
      setAddToListCard(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar. Reintentá.';
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setAddToListLoading(false);
    }
  }

  async function handleNuevaListaSubmit() {
    if (!addToListCard || addToListLoading) return;
    const name = newListName.trim();
    if (!name) {
      setToast('Escribí un nombre para la lista');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setAddToListLoading(true);
    try {
      const createRes = await fetch(`${API_BASE}/me/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (createRes.status === 401) {
        router.replace('/login');
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
      const list = (await createRes.json()) as { id: string; name: string };
      const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId: addToListCard.id }),
      });
      if (!addRes.ok) {
        const errBody = await addRes.json().catch(() => ({}));
        const msg = (errBody as { message?: string })?.message;
        throw new Error(msg || 'Error al agregar');
      }
      setToast(`Lista "${name}" creada y propiedad agregada`);
      setTimeout(() => setToast(null), 2500);
      setAddToListCard(null);
      setNewListName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error. Reintentá.';
      setAddToListError(msg);
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setAddToListLoading(false);
    }
  }

  function handleUndo() {
    if (!lastSwiped) return;
    setQueue((prev) => [lastSwiped.card, ...prev]);
    setLastSwiped(null);
  }

  function handleContactar(listingId: string) {
    setContactingId(listingId);
    setInquiryListingId(listingId);
  }

  function handleConsultaSent(listingId: string) {
    setLeadSentIds((prev) => new Set(prev).add(listingId));
    setToast('Consulta enviada');
    setTimeout(() => setToast(null), 3000);
    setContactingId(null);
    setInquiryListingId(null);
  }

  function handleRestartFeed() {
    setLoading(true);
    setQueue([]);
    setNextCursor(null);
    setLastSwiped(null);
    fetchFeed(null, useFeedAll, propertyTypeFilter, operationFilter)
      .then((data) => {
        if (data) {
          setQueue(data.items ?? []);
          setNextCursor(data.nextCursor ?? null);
          setEmptyCatalog(Boolean((data as { emptyCatalog?: boolean }).emptyCatalog));
          if (useFeedAll && (data.items?.length ?? 0) > 0) setUsedFeedAll(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function handleVerSimilares() {
    setLoading(true);
    setQueue([]);
    setNextCursor(null);
    const data = await fetchFeed(null, true, propertyTypeFilter, operationFilter);
    if (data) {
      setQueue(data.items ?? []);
      setNextCursor(data.nextCursor ?? null);
      setUsedFeedAll(true);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="max-w-md w-full">
          <div className="aspect-[4/3] bg-gray-200 rounded-xl animate-pulse" />
          <div className="mt-4 space-y-2">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
          </div>
          <div className="flex gap-3 mt-6">
            <div className="flex-1 h-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 h-12 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--mp-bg)]">
      <ActiveSearchBar />
      <div className="w-full flex-1 flex flex-col">
        {/* Header: título + nav compacta */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-[var(--mp-foreground)]">{PRODUCT_NAME}</h1>
          <nav className="flex items-center gap-3 text-xs text-[var(--mp-muted)]">
            <Link href="/feed/list" className="hover:text-[var(--mp-foreground)] transition-colors">
              Lista
            </Link>
            <Link href="/me/saved" className="hover:text-[var(--mp-foreground)] transition-colors">
              Favoritos
            </Link>
            <Link href="/leads" className="hover:text-[var(--mp-foreground)] transition-colors">
              Consultas
            </Link>
          </nav>
        </div>

        <Link
          href="/assistant"
          className="mb-3 text-sm text-[var(--mp-accent)] hover:text-[var(--mp-accent-hover)] font-medium"
        >
          🔍 Buscar
        </Link>

        {toast && (
          <div className="mb-3 p-3 rounded-xl bg-[var(--mp-premium)]/20 text-slate-800 border border-[var(--mp-premium)]/40 text-sm">
            {toast}
          </div>
        )}

        {hasActiveSearch === false && (
          <div className="mb-3 p-3 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] text-sm text-[var(--mp-muted)]">
            Definí qué buscás para ver solo lo que te interesa.{' '}
            <Link href="/assistant" className="text-[var(--mp-accent)] font-medium hover:underline">
              Buscar
            </Link>
          </div>
        )}

        {fallbackUsed && (
          <div className="mb-3 p-3 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] text-sm text-[var(--mp-muted)]">
            No hubo matches exactos, mostrando similares.
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

        {currentCard ? (
          <>
            <div className="flex-1 flex flex-col">
              <SwipeCard
                card={currentCard}
                onClick={() => router.push(`/listing/${currentCard.id}`)}
                showInvestorLink={false}
              />
            </div>

            {/* Acciones mín 48px para accesibilidad (Regla 3 taps) */}
            <div className="flex gap-3 mt-6 pb-4 items-stretch">
              <button
                onClick={() => handleSwipe(currentCard.id, 'NOPE')}
                disabled={swipeDisabled}
                className="flex-1 min-h-[48px] py-3 bg-red-100 text-red-700 rounded-full font-medium hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Nope
              </button>
              <button
                type="button"
                onClick={() => handleSaveToList(currentCard.id, 'FAVORITE')}
                disabled={swipeDisabled}
                className="w-14 h-14 min-h-[48px] flex items-center justify-center bg-yellow-100 text-yellow-800 rounded-full hover:bg-yellow-200 transition text-2xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Agregar a favoritos"
              >
                ★
              </button>
              <button
                type="button"
                onClick={handleAgregarALista}
                disabled={swipeDisabled}
                className="w-14 h-14 min-h-[48px] flex items-center justify-center bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition text-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Agregar a lista"
              >
                + Lista
              </button>
              <button
                onClick={() => handleSwipe(currentCard.id, 'LIKE')}
                disabled={swipeDisabled}
                className="flex-1 min-h-[48px] py-3 bg-green-100 text-green-700 rounded-full font-medium hover:bg-green-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Like
              </button>
            </div>

            <div className="flex justify-center gap-4 mb-4 flex-wrap">
              {lastSwiped && (
                <button
                  onClick={handleUndo}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Deshacer último
                </button>
              )}
              <button
                onClick={() => setInquiryListingId(currentCard.id)}
                className={`px-4 py-3 text-sm rounded-xl font-medium min-h-[48px] flex items-center ${
                  leadSentIds.has(currentCard.id)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'btn-accent'
                }`}
              >
                {leadSentIds.has(currentCard.id) ? 'Reenviar consulta' : 'Quiero que me contacten'}
              </button>
              <Link
                href="/me/saved"
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 font-medium"
              >
                Listas favoritas
              </Link>
            </div>

            {inquiryListingId && (
              <InquiryModal
                open={!!inquiryListingId}
                onClose={() => {
                  setContactingId(null);
                  setInquiryListingId(null);
                }}
                listingId={inquiryListingId}
                source="FEED"
                onSent={() => handleConsultaSent(inquiryListingId)}
              />
            )}

            {addToListCard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[90vh] overflow-auto">
                  <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
                  {addToListError && <PlanErrorBlock message={addToListError} className="mb-3" />}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={async () => {
                        setAddToListError(null);
                        setAddToListLoading(true);
                        try {
                          const result = await handleSaveToList(addToListCard.id, 'LATER');
                          if (result.ok) setAddToListCard(null);
                          else if (result.error) setAddToListError(result.error);
                        } finally {
                          setAddToListLoading(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 transition-colors text-left disabled:opacity-50"
                    >
                      👍 Mis like
                    </button>
                    <button
                      type="button"
                      disabled={addToListLoading}
                      onClick={async () => {
                        setAddToListError(null);
                        setAddToListLoading(true);
                        try {
                          const result = await handleSaveToList(addToListCard.id, 'FAVORITE');
                          if (result.ok) setAddToListCard(null);
                          else if (result.error) setAddToListError(result.error);
                        } finally {
                          setAddToListLoading(false);
                        }
                      }}
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
                              onClick={() => handleAddToCustomList(l.id)}
                              className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 transition-colors text-left"
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                        handleContactar(addToListCard.id);
                        setAddToListCard(null);
                      }}
                      disabled={!!contactingId}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {contactingId === addToListCard.id
                        ? 'Enviando...'
                        : 'Quiero que me contacten'}
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
            <p className="text-[var(--mp-foreground)] font-medium">
              {emptyCatalog ? 'No hay propiedades en el catálogo' : 'No hay más resultados'}
            </p>
            <p className="text-sm text-[var(--mp-muted)] max-w-xs">
              {emptyCatalog
                ? 'Activá conexiones (Yumblin, iCasas, etc.) en Ajustes > Integraciones > Importadores para cargar propiedades.'
                : !usedFeedAll
                  ? 'Probá ampliar filtros o ver el catálogo completo.'
                  : 'No quedan propiedades. Agregá más datos o cambiá la búsqueda.'}
            </p>
            {emptyCatalog && (
              <Link
                href="/settings/integrations/importers"
                className="mt-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white"
              >
                Ir a Importadores
              </Link>
            )}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {!usedFeedAll && (
                <button
                  onClick={handleVerSimilares}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white disabled:opacity-50"
                >
                  Ver similares
                </button>
              )}
              <button
                onClick={handleRestartFeed}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-card)] border border-[var(--mp-border)] text-[var(--mp-foreground)]"
              >
                Reiniciar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Celebration modal */}
      {CelebrationComponent}
    </main>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="h-32 w-full max-w-2xl bg-slate-200 rounded-xl animate-pulse" />
        </main>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
