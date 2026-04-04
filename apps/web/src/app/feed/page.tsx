'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import FeedOnboardingTip from '../../components/FeedOnboardingTip';
import SwipeCard from '../../components/SwipeCard';
import { useToast, getRandomMessage } from '../../components/FunToast';
import { useCelebration } from '../../components/Celebration';
import { recordEngagement } from '../../lib/userEngagementClient';
import { ACTIVE_SEARCH_CHANGED_EVENT } from '../../lib/activeSearchEvents';

const API_BASE = '/api';
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
  const [hasActiveSearch, setHasActiveSearch] = useState<boolean | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [emptyCatalog, setEmptyCatalog] = useState(false);
  const [usedFeedAll, setUsedFeedAll] = useState(false);
  const [starSaving, setStarSaving] = useState(false);
  const inFlightRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedAllFromUrl = searchParams?.get('feed') === 'all';

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

  const useFeedAll = feedAllFromUrl || hasActiveSearch !== true;

  const fetchFeed = useCallback(
    async (cursor?: string | null, feedAll?: boolean) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      if (feedAll) params.set('feed', 'all');
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
    fetchFeed(null, useFeedAll)
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
  }, [fetchFeed, useFeedAll]);

  const currentCard = queue[0];

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchFeed(nextCursor, usedFeedAll);
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

    if (decision === 'LIKE') {
      const newCount = likeCount + 1;
      setLikeCount(newCount);

      if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
      }

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
        recordEngagement('swipe');
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

  /** Favorito secundario: no saca la tarjeta del deck. */
  async function handleStarSave(listingId: string) {
    if (starSaving || swipeDisabled) return;
    setStarSaving(true);
    try {
      const res = await fetch(`${API_BASE}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { message?: string })?.message ?? 'No se pudo guardar';
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
        return;
      }
      recordEngagement('save');
      showSuccess('Guardado en favoritos', '⭐');
    } finally {
      setStarSaving(false);
    }
  }

  function handleUndo() {
    if (!lastSwiped) return;
    setQueue((prev) => [lastSwiped.card, ...prev]);
    setLastSwiped(null);
  }

  function handleRestartFeed() {
    setLoading(true);
    setQueue([]);
    setNextCursor(null);
    setLastSwiped(null);
    fetchFeed(null, useFeedAll)
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
    const data = await fetchFeed(null, true);
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
      <div className="-mx-4 md:-mx-6 shrink-0">
        <ActiveSearchBar />
      </div>
      <div className="w-full flex-1 flex flex-col pt-4">
        <FeedOnboardingTip />
        {toast && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--mp-premium)]/20 text-slate-800 border border-[var(--mp-premium)]/40 text-sm">
            {toast}
          </div>
        )}

        {fallbackUsed && (
          <p className="mb-4 text-xs text-[var(--mp-muted)]">
            No hubo coincidencias exactas; mostramos opciones similares.
          </p>
        )}

        {currentCard ? (
          <>
            <div className="flex-1 flex flex-col min-h-0">
              <SwipeCard
                card={currentCard}
                onClick={() => router.push(`/listing/${currentCard.id}`)}
                showInvestorLink={false}
                swipeActions={{
                  onLeft: () => handleSwipe(currentCard.id, 'NOPE'),
                  onRight: () => handleSwipe(currentCard.id, 'LIKE'),
                  disabled: swipeDisabled,
                }}
              />
            </div>

            <div className="flex flex-col gap-4 mt-8 pb-6">
              <div className="flex gap-3 items-stretch">
                <button
                  type="button"
                  onClick={() => handleSwipe(currentCard.id, 'NOPE')}
                  disabled={swipeDisabled}
                  className="flex-1 min-h-[52px] py-3 rounded-full text-base font-semibold border border-rose-300/90 bg-rose-50/90 text-rose-900 hover:bg-rose-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Pasar propiedad"
                >
                  👎 Pasar
                </button>
                <button
                  type="button"
                  onClick={() => handleSwipe(currentCard.id, 'LIKE')}
                  disabled={swipeDisabled}
                  className="flex-1 min-h-[52px] py-3 rounded-full text-base font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Me interesa"
                >
                  👍 Me interesa
                </button>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleStarSave(currentCard.id)}
                  disabled={swipeDisabled || starSaving}
                  className="min-h-[44px] px-5 py-2 rounded-full text-sm font-medium text-[var(--mp-muted)] border border-transparent hover:border-[var(--mp-border)] hover:bg-[var(--mp-card)] disabled:opacity-50"
                  title="Guardar en favoritos sin decidir aún"
                >
                  ⭐ Guardar
                </button>
              </div>
              {lastSwiped && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="text-sm text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] underline"
                  >
                    Deshacer última acción
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            {hasActiveSearch === false && !emptyCatalog ? (
              <>
                <p className="text-[var(--mp-foreground)] font-medium text-lg">
                  Definí qué buscás para un match más preciso
                </p>
                <p className="text-sm text-[var(--mp-muted)] max-w-md leading-relaxed">
                  Ahora estás viendo el catálogo general. En{' '}
                  <strong className="text-[var(--mp-foreground)]">Inicio</strong> o el{' '}
                  <strong className="text-[var(--mp-foreground)]">asistente</strong> podés describir
                  zona, tipo y presupuesto, guardar la búsqueda y activarla: el feed prioriza esos
                  criterios.
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-2 justify-center">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96]"
                  >
                    Ir a Inicio
                  </Link>
                  <Link
                    href="/assistant"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-medium border border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
                  >
                    Abrir asistente
                  </Link>
                  <Link
                    href="/search"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-medium text-[var(--mp-accent)] hover:underline"
                  >
                    Búsqueda por filtros
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-[var(--mp-foreground)] font-medium text-lg">
                  {emptyCatalog ? 'No hay propiedades en el catálogo' : 'No hay más resultados'}
                </p>
                <p className="text-sm text-[var(--mp-muted)] max-w-md leading-relaxed">
                  {emptyCatalog
                    ? 'Activá importadores en Configuración para cargar propiedades.'
                    : !usedFeedAll
                      ? 'Podés ampliar el contexto o revisar el catálogo completo.'
                      : 'No quedan propiedades en este contexto. Afiná filtros en el asistente o probá otra búsqueda guardada.'}
                </p>
                {!emptyCatalog && (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-2 justify-center">
                    <Link
                      href="/assistant"
                      className="text-sm font-semibold text-[var(--mp-accent)] hover:underline"
                    >
                      Ajustar con el asistente
                    </Link>
                    <span className="hidden sm:inline text-[var(--mp-border)]" aria-hidden>
                      ·
                    </span>
                    <Link
                      href="/searches"
                      className="text-sm font-semibold text-[var(--mp-accent)] hover:underline"
                    >
                      Mis búsquedas
                    </Link>
                  </div>
                )}
              </>
            )}
            {emptyCatalog && (
              <Link
                href="/settings/integrations/importers"
                className="mt-2 px-5 py-2.5 rounded-full text-sm font-medium bg-[var(--mp-accent)] text-white"
              >
                Ir a importadores
              </Link>
            )}
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {!(hasActiveSearch === false && !emptyCatalog) && !usedFeedAll && (
                <button
                  onClick={handleVerSimilares}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-full text-sm font-medium bg-[var(--mp-accent)] text-white disabled:opacity-50"
                >
                  Ver similares
                </button>
              )}
              <button
                onClick={handleRestartFeed}
                className="px-5 py-2.5 rounded-full text-sm font-medium bg-[var(--mp-card)] border border-[var(--mp-border)] text-[var(--mp-foreground)]"
              >
                Reiniciar
              </button>
            </div>
          </div>
        )}
      </div>

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
