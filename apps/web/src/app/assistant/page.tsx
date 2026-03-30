'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { AssistantSearchResponse, ListingCard, SearchFilters } from '@matchprop/shared';
import { ASSISTANT_BUILD } from '../../lib/build-id';
import { filtersToHumanSummary, searchFiltersToChips } from '../../lib/filters-summary';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import FilterChips from '../../components/FilterChips';
import AssistantChatInput from '../../components/AssistantChatInput';
import SaveActiveSearchModal from '../../components/SaveActiveSearchModal';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import ListingImage from '../../components/ListingImage';
import { ASSISTANT_INPUT_PLACEHOLDER_EXAMPLE } from '../../lib/assistant-examples';
import { recordEngagement } from '../../lib/userEngagementClient';
import { notifyActiveSearchChanged } from '../../lib/activeSearchEvents';
import { buildBuscandoLine } from '../../lib/active-search-label';

const API_BASE = '/api';

/** Mapea filtros del asistente a body de PUT /preferences (Sprint 14) */
function mapFiltersToPreferenceBody(f: SearchFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (f.operationType) body.operation = f.operationType;
  if (f.priceMin != null) body.minPrice = f.priceMin;
  if (f.priceMax != null) body.maxPrice = f.priceMax;
  if (f.currency) body.currency = f.currency;
  if (f.propertyType?.length) body.propertyTypes = f.propertyType;
  if (f.bedroomsMin != null) body.bedroomsMin = f.bedroomsMin;
  if (f.bathroomsMin != null) body.bathroomsMin = f.bathroomsMin;
  if (f.areaMin != null) body.areaMin = f.areaMin;
  if (f.locationText?.trim()) body.locationText = f.locationText.trim();
  return body;
}

const showDebug =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_DEBUG === '1';

type FallbackMode = 'STRICT' | 'RELAX' | 'BROAD' | 'FEED';

function normalizeCard(raw: unknown): ListingCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  if (!id) return null;
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
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'API_PARTNER_1',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
    propertyType: typeof c.propertyType === 'string' ? c.propertyType : null,
  };
}

function normalizePreviewItems(raw: unknown): ListingCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCard).filter((c): c is ListingCard => c !== null);
}

function AssistantPageContent() {
  const searchParams = useSearchParams();
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const startFreshNextRef = useRef(false);
  const [adjustContextBanner, setAdjustContextBanner] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantSearchResponse | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<ListingCard[]>([]);
  const [previewNextCursor, setPreviewNextCursor] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>('STRICT');
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [toast2, setToast2] = useState<string | null>(null);
  /** Señales blandas del último intent (preview / “cargar más”). */
  const [lastSoftRank, setLastSoftRank] = useState<string[]>([]);
  const router = useRouter();
  const {
    isSupported: voiceSupported,
    isListening: voiceListening,
    transcript: voiceTranscript,
    interimTranscript: voiceInterim,
    error: voiceError,
    start: voiceStart,
    stop: voiceStop,
    reset: voiceReset,
  } = useSpeechRecognition('es-AR');
  const voiceHandledRef = useRef(false);

  useEffect(() => {
    if (voiceTranscript && !voiceListening && !voiceHandledRef.current) {
      voiceHandledRef.current = true;
      setText(voiceTranscript);
      setError(null);
      voiceReset();
      handleBuscar(voiceTranscript);
    }
  }, [voiceTranscript, voiceListening]);

  useEffect(() => {
    if (voiceListening && (voiceTranscript || voiceInterim)) {
      const display = voiceTranscript + (voiceInterim ? ' ' + voiceInterim : '');
      setText(display.trim());
    }
  }, [voiceListening, voiceTranscript, voiceInterim]);

  useEffect(() => {
    const fromActive = searchParams.get('from') === 'active';

    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then(
        (data: {
          search?: {
            name?: string;
            queryText?: string | null;
            filters?: SearchFilters;
          } | null;
        }) => {
          if (!fromActive) setAdjustContextBanner(null);
          const s = data.search;
          if (!s) {
            return;
          }
          const q = s.queryText;
          if (q && typeof q === 'string' && q.trim()) {
            setText((t) => (t.trim() ? t : q.trim()));
          }
          if (fromActive) {
            const line = buildBuscandoLine({
              name: typeof s.name === 'string' ? s.name : '',
              queryText: s.queryText ?? null,
              filters: (s.filters ?? {}) as SearchFilters,
            });
            setAdjustContextBanner(`Estás buscando ${line}. ¿Qué querés cambiar?`);
          }
        }
      )
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('focus') !== 'input') return;
    const id = window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [searchParams]);

  async function fetchPreview(
    filters: SearchFilters,
    cursor?: string | null,
    mode: FallbackMode = 'STRICT',
    softPreferences?: string[]
  ): Promise<{ items: ListingCard[]; nextCursor: string | null; finalMode: FallbackMode }> {
    const body: {
      filters: SearchFilters;
      cursor?: string;
      limit?: number;
      fallbackMode?: FallbackMode;
      softPreferences?: string[];
    } = { filters, limit: 10, fallbackMode: mode };
    if (softPreferences?.length) body.softPreferences = softPreferences;
    if (cursor) body.cursor = cursor;
    const res = await fetch(`${API_BASE}/assistant/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      router.replace('/login');
      return { items: [], nextCursor: null, finalMode: mode };
    }
    if (!res.ok) return { items: [], nextCursor: null, finalMode: mode };
    const data = (await res.json()) as { items?: unknown[]; nextCursor?: string | null };
    let items = normalizePreviewItems(data.items ?? []);
    let next = data.nextCursor ?? null;
    let finalMode = mode;
    if (items.length === 0) {
      const modes: FallbackMode[] =
        mode === 'STRICT' ? ['RELAX', 'BROAD'] : mode === 'RELAX' ? ['BROAD'] : [];
      for (const nextMode of modes) {
        const fb = await fetch(`${API_BASE}/assistant/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            filters,
            limit: 10,
            fallbackMode: nextMode,
            ...(softPreferences?.length ? { softPreferences } : {}),
          }),
        });
        if (fb.ok) {
          const fbData = (await fb.json()) as { items?: unknown[]; nextCursor?: string | null };
          const fbItems = normalizePreviewItems(fbData.items ?? []);
          if (fbItems.length > 0) {
            items = fbItems;
            next = fbData.nextCursor ?? null;
            finalMode = nextMode;
            break;
          }
        }
      }
    }
    return { items, nextCursor: next, finalMode };
  }

  async function handleBuscar(overrideText?: string) {
    const q = (overrideText ?? text).trim();
    if (!q || q.length < 3) {
      setError('Escribí al menos 3 caracteres.');
      return;
    }
    setError(null);
    const previousFilters =
      !startFreshNextRef.current &&
      result?.filters &&
      Object.keys(result.filters).length > 0
        ? result.filters
        : undefined;
    if (startFreshNextRef.current) startFreshNextRef.current = false;

    setResult(null);
    setPreviewItems([]);
    setPreviewNextCursor(null);
    setPreviewLoaded(false);
    setFallbackMode('STRICT');
    setPropertyTypeFilter(null);
    setOperationFilter(null);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/assistant/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: q,
          ...(previousFilters ? { previousFilters } : {}),
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
          debug?: { path?: string; error?: string };
        };
        let msg = err?.message;
        if (!msg) {
          if (res.status === 500) msg = 'Error del servidor. Probá de nuevo en un momento.';
          else if (res.status === 502 || res.status === 503)
            msg = 'Servicio temporalmente no disponible. Probá en un momento.';
          else if (res.status === 401) msg = 'Sesión expirada. Volvé a iniciar sesión.';
          else msg = `Error al buscar (${res.status}). Probá de nuevo.`;
        }
        const debugPath = res.headers.get('X-MatchProp-Path') ?? err?.debug?.path;
        if (debugPath && process.env.NODE_ENV === 'development') msg += ` [path: ${debugPath}]`;
        setError(msg);
        return;
      }
      const data = (await res.json()) as AssistantSearchResponse;
      recordEngagement('search');
      setResult(data);
      setSavedId(null);
      const filters = data.filters ?? {};
      const softRank = [
        ...(data.intent?.softPreferences ?? []),
        ...(data.intent?.lifestyleSignals ?? []),
      ];
      setLastSoftRank(softRank);
      try {
        if (Object.keys(filters).length > 0) {
          const preview = await fetchPreview(filters, null, 'STRICT', softRank);
          setPreviewItems(preview.items);
          setPreviewNextCursor(preview.nextCursor);
          setFallbackMode(preview.finalMode);
          setPreviewLoaded(true);
          const pref = mapFiltersToPreferenceBody(filters);
          if (Object.keys(pref).length > 0) {
            fetch(`${API_BASE}/preferences`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(pref),
            }).catch(() => {});
          }
        } else {
          const { items, nextCursor: nc } = await fetchPreview({}, null, 'FEED', softRank);
          setPreviewItems(items);
          setPreviewNextCursor(nc);
          setFallbackMode('FEED');
          setPreviewLoaded(true);
        }
      } finally {
        setPreviewLoaded(true);
      }
      // Activar búsqueda automáticamente para que Match y Lista funcionen sin tener que guardar
      try {
        const saveRes = await fetch(`${API_BASE}/searches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: q.slice(0, 50) || 'Búsqueda actual',
            text: q || undefined,
            filters: data.filters ?? {},
          }),
        });
        if (saveRes.ok) {
          const { id } = (await saveRes.json()) as { id: string };
          await fetch(`${API_BASE}/me/active-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ searchId: id }),
          });
          notifyActiveSearchChanged();
          setSavedId(id);
        }
      } catch {
        // No bloquear si falla el guardado automático
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  function getEffectiveFilters(overrides?: {
    propertyType?: string | null;
    operation?: 'SALE' | 'RENT' | null;
  }): SearchFilters {
    const base = (result?.filters ?? {}) as SearchFilters;
    const next: SearchFilters = { ...base };

    const pt = overrides?.propertyType !== undefined ? overrides.propertyType : propertyTypeFilter;
    const op = overrides?.operation !== undefined ? overrides.operation : operationFilter;

    if (pt) {
      next.propertyType = [pt];
    } else {
      delete next.propertyType;
    }

    if (op) {
      next.operationType = op;
    } else {
      delete next.operationType;
    }

    return next;
  }

  async function handlePreview(
    cursor?: string | null,
    mode?: FallbackMode,
    filterOverrides?: { propertyType?: string | null; operation?: 'SALE' | 'RENT' | null }
  ) {
    const isLoadMore = !!cursor;
    const useMode = mode ?? fallbackMode;
    const filters = getEffectiveFilters(filterOverrides);

    if (isLoadMore) setLoadingMore(true);
    else setLoadingPreview(true);
    setError(null);

    try {
      const { items, nextCursor, finalMode } = await fetchPreview(
        filters,
        cursor,
        useMode,
        lastSoftRank
      );
      if (isLoadMore) {
        setPreviewItems((prev) => [...prev, ...items]);
      } else {
        setPreviewItems(items);
        setFallbackMode(finalMode);
      }
      setPreviewNextCursor(nextCursor);
      setPreviewLoaded(true);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoadingPreview(false);
      setLoadingMore(false);
    }
  }

  async function handleActivateAlerts() {
    if (!savedId) return;
    try {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: savedId, type: 'NEW_LISTING' }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.ok) {
        setToast('Alertas activadas. Te avisamos cuando aparezcan propiedades nuevas.');
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast('Error al activar alertas');
      setTimeout(() => setToast(null), 3000);
    }
  }

  const hasFilters = result?.filters && Object.keys(result.filters).length > 0;
  const showWarning = (result?.warnings?.length ?? 0) > 0;
  const filtersEmptyButExplained =
    result &&
    result.explanation &&
    result.explanation.includes('Interpreté que buscás') &&
    (!result.filters || Object.keys(result.filters).length === 0);

  const humanSummary = filtersToHumanSummary(result?.filters);
  const activeFilterChips = result ? searchFiltersToChips(result.filters) : [];

  useEffect(() => {
    const ids = previewItems.filter((c) => c.id).map((c) => c.id);
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
  }, [previewItems]);

  async function handleContactar(listingId: string) {
    if (contactingId) return;
    setContactingId(listingId);
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId, source: 'ASSISTANT' }),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        setListingsStatus((prev) => ({
          ...prev,
          [listingId]: {
            ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
            lead: { status: 'PENDING' },
          },
        }));
        setToast2('Consulta enviada');
        setTimeout(() => setToast2(null), 3000);
      }
    } finally {
      setContactingId(null);
    }
  }

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
        if (res.status === 401) router.replace('/login');
        else if (res.ok) {
          recordEngagement('save');
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: true,
            },
          }));
          setToast2('Agregado a favoritos');
          setTimeout(() => setToast2(null), 2500);
        }
      }
    } catch {
      setToast2('Error al actualizar');
      setTimeout(() => setToast2(null), 2000);
    }
  }

  // Gestión de listas: en esta vista solo se soportan favoritos (handleToggleFavorite);
  // la creación y edición de listas personalizadas se hace en feed, list y saved.

  async function copyFilters() {
    if (!result?.filters) return;
    await navigator.clipboard.writeText(humanSummary);
  }

  const showRelaxHint = previewLoaded && previewItems.length === 0 && hasFilters;

  return (
    <main className="min-h-screen pb-8">
      {result ? (
        <SaveActiveSearchModal
          open={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          savedSearchId={savedId}
          initialName={text.trim().slice(0, 100) || 'Mi búsqueda'}
          initialText={text.trim()}
          initialFilters={result.filters ?? {}}
          onSuccess={({ id }) => {
            setSavedId(id);
            notifyActiveSearchChanged();
            setToast('Guardada y activa');
            setTimeout(() => setToast(null), 4000);
          }}
        />
      ) : null}
      <div className="-mx-4 md:-mx-6 shrink-0">
        <ActiveSearchBar sticky={false} />
      </div>
      <div className="px-4 pt-4 max-w-xl mx-auto space-y-5">
        {showDebug && (
          <p className="text-xs text-gray-400 mb-2">Assistant UI build: {ASSISTANT_BUILD}</p>
        )}

        <p className="text-center text-xs text-[var(--mp-muted)] px-2">
          <span className="font-semibold text-[var(--mp-foreground)]">Modo avanzado.</span> Búsqueda
          rápida en el{' '}
          <Link href="/dashboard" className="text-[var(--mp-accent)] font-semibold hover:underline">
            inicio
          </Link>
          .
        </p>

        {/* Hero: contá lo que necesitás */}
        <section className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--mp-foreground)] mb-2">
            Asistente de búsqueda
          </h1>
          <p className="text-[var(--mp-muted)] text-sm md:text-base max-w-lg">
            Interpretamos tu intención (texto o voz), traducimos a filtros reales del catálogo y te
            mostramos resultados rankeados. Podés refinar en mensajes cortos sin empezar de cero.
          </p>
        </section>

        {/* Tres formas de buscar */}
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-[var(--mp-muted)] font-medium">Buscar:</span>
          <span className="px-3 py-1.5 rounded-full bg-[var(--mp-accent)] text-white font-medium text-xs">
            Por texto o voz
          </span>
          <Link
            href="/search"
            className="px-3 py-1.5 rounded-full bg-[var(--mp-bg)] border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:border-[var(--mp-accent)]/40 transition-colors"
          >
            Por filtros
          </Link>
          <Link
            href="/search/map"
            className="px-3 py-1.5 rounded-full bg-[var(--mp-bg)] border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:border-[var(--mp-accent)]/40 transition-colors"
          >
            En mapa
          </Link>
        </div>

        {/* Input principal */}
        <section className="rounded-2xl border-2 border-[var(--mp-accent)]/30 bg-[var(--mp-card)] p-4 shadow-sm">
          {adjustContextBanner && (
            <div
              role="status"
              className="mb-3 flex gap-2 items-start rounded-xl border border-[var(--mp-accent)]/30 bg-[color-mix(in_srgb,var(--mp-accent)_8%,var(--mp-card))] px-3 py-2.5 text-sm text-[var(--mp-foreground)] transition-opacity duration-300"
            >
              <p className="flex-1 min-w-0 leading-snug">{adjustContextBanner}</p>
              <button
                type="button"
                onClick={() => setAdjustContextBanner(null)}
                className="shrink-0 min-h-[36px] min-w-[36px] rounded-lg text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] transition-colors"
                aria-label="Cerrar mensaje"
              >
                ✕
              </button>
            </div>
          )}
          <AssistantChatInput
            textAreaRef={chatInputRef}
            value={text}
            onChange={setText}
            onSend={() => handleBuscar()}
            loading={loading}
            placeholder={ASSISTANT_INPUT_PLACEHOLDER_EXAMPLE}
            voiceSupported={!!voiceSupported}
            voiceListening={!!voiceListening}
            onVoiceClick={() => {
              voiceHandledRef.current = false;
              voiceStart();
            }}
            maxLength={500}
          />
          {result && (
            <div className="mt-3 pt-3 border-t border-[var(--mp-border)]/60">
              <p className="text-xs font-medium text-[var(--mp-muted)] mb-2">
                Filtros que activa esta búsqueda
              </p>
              {activeFilterChips.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--mp-accent)]/12 text-[var(--mp-foreground)] border border-[var(--mp-accent)]/25"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--mp-muted)]">
                  Sin filtros estructurados todavía; probá sumar zona, tipo o precio en el texto.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <p className="text-xs text-[var(--mp-muted)]">
              Refiná con frases cortas: &quot;con cochera&quot;, &quot;más barato&quot;, &quot;solo
              depto&quot;.
            </p>
            <button
              type="button"
              onClick={() => {
                startFreshNextRef.current = true;
                setResult(null);
                setPreviewItems([]);
                setPreviewNextCursor(null);
                setLastSoftRank([]);
              }}
              className="text-xs font-medium text-[var(--mp-accent)] hover:underline shrink-0"
            >
              Nueva búsqueda desde cero
            </button>
          </div>
        </section>

        {/* Acceso rápido compacto */}
        <section className="flex flex-wrap gap-2">
          <Link
            href="/searches"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)] text-sm text-[var(--mp-foreground)] hover:border-[var(--mp-accent)]/40"
          >
            <span>📁</span> Búsquedas
          </Link>
          <Link
            href="/alerts"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)] text-sm text-[var(--mp-foreground)] hover:border-[var(--mp-accent)]/40"
          >
            <span>🔔</span> Alertas
          </Link>
          <Link
            href="/leads"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)] text-sm text-[var(--mp-foreground)] hover:border-[var(--mp-accent)]/40"
          >
            <span>💬</span> Consultas
          </Link>
          <Link
            href="/settings/integrations/assistant"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--mp-border)] text-xs text-[var(--mp-muted)] hover:text-[var(--mp-accent)]"
          >
            Configurar IA y voz
          </Link>
        </section>
        {voiceError && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm">{voiceError}</p>
          </div>
        )}
        {voiceListening && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-blue-800">Escuchando...</span>
              <button
                type="button"
                onClick={voiceStop}
                className="ml-auto px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Listo
              </button>
            </div>
            {voiceTranscript || voiceInterim ? (
              <p className="text-sm text-blue-900">
                {voiceTranscript}
                {voiceInterim && <span className="text-blue-600 opacity-70"> {voiceInterim}</span>}
              </p>
            ) : (
              <p className="text-sm text-blue-600">
                Decí tu búsqueda. Cortará después de una pausa.
              </p>
            )}
          </div>
        )}

        {(toast || toast2) && (
          <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-medium">
            {toast ?? toast2}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm font-medium">{error}</p>
            {error.includes('conexión') && (
              <Link
                href="/status"
                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
              >
                Ver estado de conexión →
              </Link>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-[var(--mp-muted)] uppercase tracking-wide">
              Tu búsqueda
            </h2>
            {filtersEmptyButExplained ? (
              <p className="text-sm text-red-600">
                No se detectaron filtros. Escribí de nuevo con más detalle (zona, tipo, precio).
              </p>
            ) : (
              <p className="text-sm text-[var(--mp-foreground)]">{result.explanation}</p>
            )}
            {showWarning &&
              result.warnings?.map((w, i) => (
                <p key={i} className="text-amber-600 text-xs">
                  {w}
                </p>
              ))}

            {result.intent?.interpretationNotes?.length ? (
              <ul className="text-xs text-[var(--mp-muted)] list-disc pl-4 space-y-0.5">
                {result.intent.interpretationNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
            {result.intent &&
            (result.intent.softPreferences?.length || result.intent.lifestyleSignals?.length) ? (
              <p className="text-xs text-[var(--mp-muted)]">
                <span className="font-medium text-[var(--mp-foreground)]">Señales suaves</span>{' '}
                (priorizan títulos similares, no excluyen propiedades):{' '}
                {[
                  ...(result.intent.softPreferences ?? []),
                  ...(result.intent.lifestyleSignals ?? []),
                ].join(', ')}
              </p>
            ) : null}
            {result.intent?.usedLlm ? (
              <p className="text-xs text-emerald-700">
                Capa de lenguaje natural activa (API configurada en Integraciones → Asistente IA).
              </p>
            ) : null}

            {hasFilters && (
              <>
                <p className="text-xs text-[var(--mp-muted)]">
                  Seguí escribiendo para refinar o ajustá los filtros abajo.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--mp-foreground)]">{humanSummary}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={copyFilters}
                      className="text-xs px-2 py-1 rounded-lg bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:text-[var(--mp-foreground)]"
                    >
                      Copiar
                    </button>
                    {showDebug && (
                      <button
                        type="button"
                        onClick={() => setShowJson(!showJson)}
                        className="text-xs px-2 py-1 rounded-lg bg-[var(--mp-bg)] text-[var(--mp-muted)]"
                      >
                        {showJson ? 'JSON' : 'JSON'}
                      </button>
                    )}
                  </div>
                </div>
                {showJson && (
                  <pre className="text-xs bg-[var(--mp-bg)] p-3 rounded-lg overflow-auto">
                    {JSON.stringify(result.filters, null, 2)}
                  </pre>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--mp-border)]">
                  {/* Lista y Match siempre visibles después de buscar; Guardar y Alertas opcionales */}
                  <Link
                    href="/feed/list"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-accent)] text-white hover:opacity-90"
                  >
                    Ver listado
                  </Link>
                  <Link
                    href="/feed"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)]"
                  >
                    Match
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSaveModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)]"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleActivateAlerts}
                    disabled={!savedId}
                    title={!savedId ? 'Guardá primero para activar alertas' : undefined}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)] disabled:opacity-50"
                  >
                    Alertas
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {previewLoaded && (
          <div className="mt-6">
            {fallbackMode === 'RELAX' && previewItems.length > 0 && (
              <p className="text-sm text-amber-700 mb-3">
                No hubo resultados con todos los criterios. Mostramos propiedades similares (misma
                zona y tipo; criterios numéricos más flexibles).
              </p>
            )}
            {fallbackMode === 'BROAD' && previewItems.length > 0 && (
              <p className="text-sm text-amber-700 mb-3">
                Ampliamos la búsqueda: mismo tipo de inmueble y zona, sin otros filtros (precio,
                ambientes, amenities).
              </p>
            )}
            {fallbackMode === 'FEED' && previewItems.length > 0 && (
              <p className="text-sm text-amber-700 mb-3">
                Catálogo general (sin aplicar los filtros de tu búsqueda).
              </p>
            )}

            <p className="text-sm font-semibold text-[var(--mp-muted)] mb-2">Seguí afinando</p>
            <div className="mb-4 p-3 rounded-xl bg-[var(--mp-card)] border border-[var(--mp-border)]">
              <FilterChips
                operationFilter={operationFilter}
                propertyTypeFilter={propertyTypeFilter}
                onOperationChange={(v) => {
                  setOperationFilter(v);
                  handlePreview(null, fallbackMode, {
                    propertyType: propertyTypeFilter ?? undefined,
                    operation: v,
                  });
                }}
                onPropertyTypeChange={(v) => {
                  setPropertyTypeFilter(v);
                  handlePreview(null, fallbackMode, {
                    propertyType: v ?? undefined,
                    operation: operationFilter,
                  });
                }}
                disabled={loadingPreview}
                compact
              />
            </div>

            <h2 className="text-lg font-semibold text-[var(--mp-foreground)] mb-4">Resultados</h2>
            {previewItems.length === 0 ? (
              <div className="py-6 space-y-4">
                <p className="text-slate-600 text-sm">
                  {showRelaxHint
                    ? 'No encontramos propiedades con esos filtros exactos.'
                    : 'No hay resultados para estos filtros.'}{' '}
                  Probá similares o el catálogo completo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreview(null, 'RELAX')}
                    disabled={loadingPreview}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {loadingPreview ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      'Ver similares'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreview(null, 'FEED')}
                    disabled={loadingPreview}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Ver catálogo completo
                  </button>
                  <Link
                    href="/feed/list"
                    className="px-4 py-2 rounded-xl font-medium bg-[var(--mp-accent)] text-white hover:opacity-90 inline-block"
                  >
                    Ver listado
                  </Link>
                  <Link
                    href="/feed"
                    className="px-4 py-2 bg-[var(--mp-bg)] text-[var(--mp-foreground)] border border-[var(--mp-border)] rounded-xl font-medium hover:bg-slate-200 inline-block"
                  >
                    Ir a Match
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {previewItems.map((card) => {
                    const s = listingsStatus[card.id];
                    const inLists = s?.inLists ?? [];
                    const hasLead = !!s?.lead;
                    const leadStatus = s?.lead?.status;
                    const inFavorite = s?.inFavorite ?? false;
                    return (
                      <li
                        key={card.id}
                        className="rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 overflow-hidden"
                      >
                        {inLists.length > 0 && (
                          <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-slate-50/80">
                            {inLists.map((l) => (
                              <span
                                key={l.id}
                                className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium"
                              >
                                📁 {l.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <Link
                          href={`/listing/${card.id}`}
                          className="flex gap-3 p-4 block hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <ListingImage
                              src={card.heroImageUrl}
                              alt=""
                              fallbackClassName="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-200"
                              fallbackIcon="🏠"
                              fallbackText=""
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">
                              {card.title || 'Sin título'}
                            </p>
                            <p className="text-sm text-slate-600">
                              {card.price != null && card.currency
                                ? `${card.price.toLocaleString()} ${card.currency}`
                                : 'Consultar'}
                              {card.locationText && ` · ${card.locationText}`}
                            </p>
                          </div>
                        </Link>
                        <div className="px-4 pb-3 flex gap-2 items-center border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(card.id)}
                            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                              inFavorite
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                            title={inFavorite ? 'En favoritos' : 'Agregar a favoritos'}
                          >
                            ★
                          </button>
                          {hasLead ? (
                            <div
                              className={`flex-1 py-2 text-center text-sm rounded-xl font-medium ${
                                leadStatus === 'ACTIVE'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              ✓{' '}
                              {leadStatus === 'ACTIVE' ? 'Esperando respuesta' : 'Consulta enviada'}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleContactar(card.id)}
                              disabled={!!contactingId}
                              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {contactingId === card.id ? 'Enviando...' : 'Quiero que me contacten'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {previewNextCursor && previewItems.length > 0 && (
                  <button
                    onClick={() => handlePreview(previewNextCursor)}
                    disabled={loadingMore}
                    className="mt-4 w-full py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center pb-8 bg-[var(--mp-bg)]">
          <div className="w-8 h-8 border-2 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <AssistantPageContent />
    </Suspense>
  );
}
