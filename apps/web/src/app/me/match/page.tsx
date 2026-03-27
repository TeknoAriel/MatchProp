'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import ListingCardImageCarousel from '../../../components/ListingCardImageCarousel';
import InquiryModal from '../../../components/InquiryModal';
import { fetchListingsBatchByIds } from '../../../lib/fetch-listings-batch';

const API_BASE = '/api';

type ListingStatus = {
  inFavorite: boolean;
  inLike: boolean;
  inLists: { id: string; name: string }[];
  lead: { status: string } | null;
};

function getMatchPriority(status?: ListingStatus): number {
  if (status?.inLike) return 0;
  if (status?.inFavorite) return 1;
  if (status?.lead?.status === 'ACTIVE') return 2;
  return 3;
}

function normalizeCard(
  raw: unknown
): (ListingCard & { media?: { url: string; sortOrder: number }[] }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  if (!id) return null;
  const media = Array.isArray(c.media)
    ? (c.media as { url?: string; sortOrder?: number }[])
        .filter((m): m is { url: string; sortOrder?: number } => typeof m?.url === 'string')
        .map((m, i) => ({
          url: m.url,
          sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : i,
        }))
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
    heroImageUrl: typeof c.heroImageUrl === 'string' ? c.heroImageUrl : null,
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'API_PARTNER_1',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
    ...(media?.length ? { media } : {}),
  };
}

export default function MyMatchPage() {
  const router = useRouter();
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsStatus, setListingsStatus] = useState<Record<string, ListingStatus>>({});
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);

  const fetchFeed = useCallback(
    async (searchId?: string | null): Promise<ListingCard[]> => {
      const url = searchId
        ? `${API_BASE}/feed?limit=100&includeTotal=1&searchId=${encodeURIComponent(searchId)}`
        : `${API_BASE}/feed?limit=100&includeTotal=1`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return [];
      }
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items ?? [])
        .map(normalizeCard)
        .filter((c: ListingCard | null): c is ListingCard => c !== null);
    },
    [router]
  );

  const fetchSavedCards = useCallback(
    async (listType: 'LATER' | 'FAVORITE'): Promise<ListingCard[]> => {
      const res = await fetch(`${API_BASE}/me/saved?listType=${listType}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return [];
      }
      if (!res.ok) return [];
      const data: unknown = await res.json();
      const rawItems = (data as { items?: unknown[] } | null)?.items ?? [];
      const parsed = rawItems.map((it) => {
        if (!it || typeof it !== 'object')
          return { listingId: '', listingRaw: undefined as unknown };
        const obj = it as { listingId?: unknown; listing?: unknown };
        return {
          listingId: typeof obj.listingId === 'string' ? obj.listingId : '',
          listingRaw: obj.listing,
        };
      });
      const directCards = parsed
        .map((p) => normalizeCard(p.listingRaw))
        .filter((c: ListingCard | null): c is ListingCard => c !== null);

      const missingIds = Array.from(
        new Set(
          parsed
            .filter((p) => !normalizeCard(p.listingRaw) && p.listingId)
            .map((p) => p.listingId)
            .filter(Boolean)
        )
      );
      const batchPayloads = await fetchListingsBatchByIds(API_BASE, missingIds);
      const hydratedCards = batchPayloads
        .map((payload) => normalizeCard(payload))
        .filter((c): c is ListingCard => c !== null);
      const byId = new Map<string, ListingCard>();
      for (const c of [...directCards, ...hydratedCards]) byId.set(c.id, c);
      return Array.from(byId.values());
    },
    [router]
  );

  useEffect(() => {
    async function load() {
      const [likesCards, favoritesCards] = await Promise.all([
        fetchSavedCards('LATER'),
        fetchSavedCards('FAVORITE'),
      ]);

      let feedCards: ListingCard[] = await fetchFeed();
      if (feedCards.length === 0) {
        const searchesRes = await fetch(`${API_BASE}/searches`, { credentials: 'include' });
        if (searchesRes.ok) {
          const searches = await searchesRes.json();
          const first = Array.isArray(searches) ? searches[0] : null;
          if (first?.id) {
            await fetch(`${API_BASE}/me/active-search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ searchId: first.id }),
            });
            feedCards = await fetchFeed(first.id);
          }
        }
      }

      // Orden base: likes -> favoritos -> resto (de búsquedas activas).
      const savedIds = new Set<string>([...likesCards, ...favoritesCards].map((c) => c.id));
      const restCards = feedCards.filter((c) => !savedIds.has(c.id));
      const combined = [...likesCards, ...favoritesCards, ...restCards];

      if (combined.length === 0) {
        setItems([]);
        setListingsStatus({});
        setLoading(false);
        return;
      }

      const ids = combined.map((c) => c.id).filter(Boolean);
      const baseStatus: Record<string, ListingStatus> = {};
      for (const c of likesCards) {
        baseStatus[c.id] = { inLike: true, inFavorite: false, inLists: [], lead: null };
      }
      for (const c of favoritesCards) {
        baseStatus[c.id] = { inLike: false, inFavorite: true, inLists: [], lead: null };
      }

      try {
        const r = await fetch(`${API_BASE}/listings/my-status-bulk?ids=${ids.join(',')}`, {
          credentials: 'include',
        });
        const data: { items?: Record<string, ListingStatus> } = r.ok ? await r.json() : {};
        const status = data.items ?? {};
        const stableOrder = new Map(combined.map((card, idx) => [card.id, idx]));
        const ordered = [...combined].sort((a, b) => {
          const pa = getMatchPriority(status[a.id] ?? baseStatus[a.id]);
          const pb = getMatchPriority(status[b.id] ?? baseStatus[b.id]);
          if (pa !== pb) return pa - pb;
          return (stableOrder.get(a.id) ?? 0) - (stableOrder.get(b.id) ?? 0);
        });

        setItems(ordered);
        setListingsStatus(status);
      } catch {
        setItems(combined);
        setListingsStatus(baseStatus);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fetchFeed, fetchSavedCards]);

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
          ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
          inLike: !inLike,
        },
      }));
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
          ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
          inFavorite: !inFav,
        },
      }));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--mp-muted)] mt-3">Cargando tus matches...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 bg-[var(--mp-bg)]">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">Mis match</h1>
            <p className="text-sm text-[var(--mp-muted)] mt-0.5">
              Propiedades de tus búsquedas activas. Primero like 👍, luego favoritos ★.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-sky-600 hover:underline">
            ← Inicio
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)]">
            <span className="text-4xl block mb-3">🔥</span>
            <p className="text-[var(--mp-foreground)] font-medium">Sin matches todavía</p>
            <p className="text-sm text-[var(--mp-muted)] mt-2">
              Creá una búsqueda y activala para ver propiedades que matchean.
            </p>
            <Link
              href="/assistant"
              className="inline-block mt-4 px-4 py-2 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600"
            >
              Ir a Buscar
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((card) => (
              <div
                key={card.id}
                className="rounded-xl overflow-hidden bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-sm"
              >
                <Link href={`/listing/${card.id}`} className="block">
                  <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
                    <ListingCardImageCarousel
                      heroImageUrl={card.heroImageUrl}
                      media={(card as { media?: { url: string; sortOrder: number }[] }).media}
                      alt={card.title ?? ''}
                    />
                  </div>
                  <div className="p-3">
                    <h2 className="font-medium truncate">{card.title ?? 'Sin título'}</h2>
                    <p className="text-sm text-[var(--mp-muted)]">
                      {card.price != null
                        ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                        : 'Consultar'}
                    </p>
                    {card.locationText && (
                      <p className="text-xs text-[var(--mp-muted)] truncate">{card.locationText}</p>
                    )}
                  </div>
                </Link>
                <div className="px-3 pb-3 flex gap-2 items-center">
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
                        ? 'bg-amber-500 text-white'
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
                    onClick={(e) => {
                      e.preventDefault();
                      setInquiryListingId(card.id);
                    }}
                    disabled={!!listingsStatus[card.id]?.lead}
                    className={`flex-1 py-2 text-white text-sm rounded-lg font-medium transition-colors ${
                      listingsStatus[card.id]?.lead
                        ? 'bg-emerald-600'
                        : 'bg-sky-500 hover:bg-sky-600'
                    } disabled:opacity-100`}
                  >
                    {listingsStatus[card.id]?.lead
                      ? `✓ Consulta enviada`
                      : 'Quiero que me contacten'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inquiryListingId && (
        <InquiryModal
          open={!!inquiryListingId}
          onClose={() => setInquiryListingId(null)}
          listingId={inquiryListingId}
          source="LIST"
          onSent={() => setInquiryListingId(null)}
          onSentLead={(lead) => {
            setListingsStatus((prev) => ({
              ...prev,
              [lead.listingId]: {
                ...(prev[lead.listingId] ?? {
                  inFavorite: false,
                  inLike: false,
                  inLists: [],
                  lead: null,
                }),
                lead: { status: lead.status ?? 'PENDING' },
              },
            }));
          }}
        />
      )}
    </main>
  );
}
