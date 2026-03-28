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

type SavedRow = {
  listingId: string;
  listType: string;
  savedAt?: string;
  listing: unknown;
};

export default function MyMatchPage() {
  const router = useRouter();
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsStatus, setListingsStatus] = useState<Record<string, ListingStatus>>({});
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    const res = await fetch(`${API_BASE}/me/saved`, { credentials: 'include' });
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      setItems([]);
      setListingsStatus({});
      setLoading(false);
      return;
    }
    const data: { items?: SavedRow[] } = await res.json();
    const rows = data.items ?? [];

    const agg = new Map<
      string,
      { savedAt: number; inLike: boolean; inFavorite: boolean; listingRaw: unknown }
    >();

    for (const it of rows) {
      const lid = it.listingId;
      if (!lid) continue;
      const t = it.savedAt ? new Date(it.savedAt).getTime() : 0;
      const cur = agg.get(lid);
      const isLater = it.listType === 'LATER';
      const isFav = it.listType === 'FAVORITE';
      if (!cur) {
        agg.set(lid, {
          savedAt: t,
          inLike: isLater,
          inFavorite: isFav,
          listingRaw: it.listing,
        });
      } else {
        cur.savedAt = Math.max(cur.savedAt, t);
        if (isLater) cur.inLike = true;
        if (isFav) cur.inFavorite = true;
        if (!normalizeCard(cur.listingRaw) && it.listing) cur.listingRaw = it.listing;
      }
    }

    const orderedIds = [...agg.entries()].sort((a, b) => b[1].savedAt - a[1].savedAt);

    const parsed = orderedIds.map(([id, v]) => {
      const card = normalizeCard(v.listingRaw);
      return { id, card, base: v };
    });

    const directCards = parsed.filter((p) => p.card).map((p) => p.card as ListingCard);
    const missingIds = parsed.filter((p) => !p.card).map((p) => p.id);

    const batchPayloads =
      missingIds.length > 0 ? await fetchListingsBatchByIds(API_BASE, missingIds) : [];
    const hydrated = batchPayloads
      .map((payload) => normalizeCard(payload))
      .filter((c): c is ListingCard => c !== null);

    const byId = new Map<string, ListingCard>();
    for (const c of [...directCards, ...hydrated]) byId.set(c.id, c);

    const combined: ListingCard[] = orderedIds
      .map(([id]) => byId.get(id))
      .filter((c): c is ListingCard => c != null);

    if (combined.length === 0) {
      setItems([]);
      setListingsStatus({});
      setLoading(false);
      return;
    }

    const ids = combined.map((c) => c.id).filter(Boolean);
    const baseStatus: Record<string, ListingStatus> = {};
    for (const [lid, v] of agg) {
      if (!byId.has(lid)) continue;
      baseStatus[lid] = {
        inLike: v.inLike,
        inFavorite: v.inFavorite,
        inLists: [],
        lead: null,
      };
    }

    try {
      const r = await fetch(`${API_BASE}/listings/my-status-bulk?ids=${ids.join(',')}`, {
        credentials: 'include',
      });
      const dataBulk: { items?: Record<string, ListingStatus> } = r.ok ? await r.json() : {};
      const status = dataBulk.items ?? {};
      const merged: Record<string, ListingStatus> = { ...baseStatus };
      for (const id of ids) {
        const s = status[id];
        const b = baseStatus[id];
        if (s && b) {
          merged[id] = {
            inLike: b.inLike || s.inLike,
            inFavorite: b.inFavorite || s.inFavorite,
            inLists: s.inLists ?? [],
            lead: s.lead ?? null,
          };
        } else if (s) {
          merged[id] = s;
        }
      }
      setItems(combined);
      setListingsStatus(merged);
    } catch {
      setItems(combined);
      setListingsStatus(baseStatus);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

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

  async function handleRemoveFromList(listingId: string) {
    const st = listingsStatus[listingId];
    const parts: string[] = ['¿Quitar esta propiedad de Mis match?'];
    if (st?.inLike) parts.push('Se quitará de tus “me interesa”.');
    if (st?.inFavorite) parts.push('Se quitará de favoritos.');
    if (!st?.inLike && !st?.inFavorite) {
      parts.push('Dejará de mostrarse aquí.');
    }
    if (!confirm(parts.join(' '))) return;

    try {
      if (st?.inLike) {
        const res = await fetch(`${API_BASE}/me/saved/${listingId}?listType=LATER`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) return;
      }
      if (st?.inFavorite) {
        const res = await fetch(`${API_BASE}/me/saved/${listingId}?listType=FAVORITE`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) return;
      }
      setItems((prev) => prev.filter((c) => c.id !== listingId));
      setListingsStatus((prev) => {
        const next = { ...prev };
        delete next[listingId];
        return next;
      });
    } catch {
      /* ignore */
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
        <div className="w-8 h-8 border-2 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--mp-muted)] mt-3">Cargando tus matches…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-4 bg-[var(--mp-bg)]">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mp-muted)] mb-1">
            Seguimiento
          </p>
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)] tracking-tight">
            Mis match
          </h1>
          <p className="text-sm text-[var(--mp-muted)] mt-2 leading-relaxed">
            Propiedades que marcaste con me interesa o favoritos. Las más recientes arriba.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-[var(--mp-radius-card)] border border-[var(--mp-border)] bg-[var(--mp-card)]">
            <span className="text-4xl block mb-4">🔥</span>
            <p className="text-[var(--mp-foreground)] font-medium">Todavía no hay nada acá</p>
            <p className="text-sm text-[var(--mp-muted)] mt-2 max-w-xs mx-auto leading-relaxed">
              En Match usá “Me interesa” o “Guardar” y vas a ver todo acá, ordenado por lo último
              que tocaste.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center mt-6 min-h-[48px] px-6 rounded-full font-semibold bg-[var(--mp-accent)] text-white no-underline hover:opacity-[0.96]"
            >
              Definir búsqueda
            </Link>
          </div>
        ) : (
          <ul className="space-y-5 list-none p-0 m-0">
            {items.map((card) => (
              <li
                key={card.id}
                className="mp-surface overflow-hidden relative rounded-[var(--mp-radius-card)]"
              >
                <button
                  type="button"
                  onClick={() => void handleRemoveFromList(card.id)}
                  className="absolute top-2 right-2 z-10 min-h-[44px] min-w-[44px] rounded-full bg-black/50 text-white text-xl font-light leading-none flex items-center justify-center hover:bg-black/65 shadow-md [-webkit-tap-highlight-color:transparent]"
                  aria-label="Quitar del listado"
                  title="Quitar del listado"
                >
                  ×
                </button>
                <Link href={`/listing/${card.id}`} className="block">
                  <div className="aspect-[16/10] bg-[var(--mp-bg)] relative overflow-hidden">
                    <ListingCardImageCarousel
                      heroImageUrl={card.heroImageUrl}
                      media={(card as { media?: { url: string; sortOrder: number }[] }).media}
                      alt={card.title ?? ''}
                    />
                  </div>
                  <div className="p-4">
                    <h2 className="font-semibold truncate text-[var(--mp-foreground)] text-base">
                      {card.title ?? 'Sin título'}
                    </h2>
                    <p
                      className={
                        card.price != null
                          ? 'text-sm font-semibold text-[var(--mp-accent-hover)] mt-1'
                          : 'text-sm text-[var(--mp-muted)] mt-1'
                      }
                    >
                      {card.price != null
                        ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                        : 'Consultar'}
                    </p>
                    {card.locationText && (
                      <p className="text-xs text-[var(--mp-muted)] truncate mt-1">
                        {card.locationText}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="px-4 pb-4 flex gap-2 items-center flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleToggleLike(card.id)}
                    className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-lg ${
                      listingsStatus[card.id]?.inLike
                        ? 'bg-green-600 text-white'
                        : 'bg-[color-mix(in_srgb,var(--mp-muted)_14%,var(--mp-bg))] text-[var(--mp-muted)] hover:bg-[color-mix(in_srgb,var(--mp-muted)_20%,var(--mp-bg))]'
                    }`}
                    title={listingsStatus[card.id]?.inLike ? 'En “me interesa”' : 'Me interesa'}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleFavorite(card.id)}
                    className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-lg ${
                      listingsStatus[card.id]?.inFavorite
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    }`}
                    title={listingsStatus[card.id]?.inFavorite ? 'En favoritos' : 'Favorito'}
                  >
                    ★
                  </button>
                  {listingsStatus[card.id]?.lead ? (
                    <div className="flex-1 flex items-center gap-1 min-w-0">
                      <span
                        className={`flex-1 py-2.5 text-center text-sm rounded-full font-medium ${
                          listingsStatus[card.id]?.lead?.status === 'ACTIVE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
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
                        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--mp-accent)_14%,var(--mp-card))] text-[var(--mp-accent-hover)]"
                        title="Reenviar consulta"
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
                      className="flex-1 min-h-[44px] py-2.5 bg-[var(--mp-accent)] text-white text-sm rounded-full font-medium hover:bg-[var(--mp-accent-hover)]"
                    >
                      Consultar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
