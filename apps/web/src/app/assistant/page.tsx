'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AssistantSearchResponse, ListingCard, SearchFilters } from '@matchprop/shared';
import { ASSISTANT_BUILD } from '../../lib/build-id';
import { filtersToHumanSummary } from '../../lib/filters-summary';
import FilterChips from '../../components/FilterChips';
import AssistantChatInput from '../../components/AssistantChatInput';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

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

const EXAMPLES = [
  'Comprar depto 2 dorm Rosario hasta 120k USD',
  'Casa Palermo con pileta hasta 250k USD',
  'Alquiler monoambiente CABA max 500k ARS',
  'Venta departamento 3 ambientes Belgrano',
  'Alquiler casa Recoleta',
  'Comprar terreno Córdoba hasta 80k USD',
  'Venta casa 4 ambientes San Isidro',
  'Alquiler depto 2 dorm Villa Crespo max 300 USD',
  'Comprar oficina Microcentro hasta 150k USD',
  'Alquiler monoambiente Caballito',
  'Venta departamento 3 dorm con balcón Nuñez',
  'Comprar casa con quincho Tigre hasta 200k',
  'Alquiler 2 ambientes Palermo Soho',
  'Venta terreno Urbano Mendoza',
  'Alquiler casa 3 dorm La Lucila',
  'Comprar depto 1 ambiente para invertir',
  'Venta casa con pileta Pilar',
  'Alquiler loft Puerto Madero',
  'Comprar departamento 2 amb CABA zona norte',
  'Alquiler depto con cochera Belgrano',
  'Venta casa chorizo restaurada San Telmo',
  'Comprar terreno en country Escobar',
  'Alquiler 3 ambientes Palermo Hollywood',
  'Venta depto 4 ambientes Recoleta',
  'Comprar casa hasta 100k USD zona sur',
  'Alquiler monoambiente Recoleta max 400 USD',
  'Venta terreno rural Buenos Aires',
  'Comprar departamento 2 dorm Núñez',
  'Alquiler casa con jardín Martínez',
  'Venta oficina en torre corporativa',
  'Comprar depto 1 dorm para estudiantes',
  'Alquiler 2 ambientes Caballito con expensas bajas',
  'Venta casa 5 ambientes Barrio Norte',
  'Comprar terreno con servicios La Plata',
  'Alquiler depto amoblado Palermo',
  'Venta departamento con amenities CABA',
  'Comprar casa de campo Escobar',
  'Alquiler monoambiente Palermo bajo',
  'Venta depto 3 ambientes con terraza',
  'Comprar terreno en loteo Nordelta',
  'Alquiler casa 4 dorm San Isidro',
  'Venta casa quinta Pilar',
  'Comprar depto 2 dorm hasta 90k USD',
  'Alquiler loft en barrio cerrado',
  'Venta departamento piso alto Palermo',
  'Comprar casa con piscina hasta 180k',
  'Alquiler 3 ambientes Belgrano C',
  'Venta terreno comercial Avellaneda',
  'Comprar depto nuevo en pozo CABA',
  'Alquiler casa 2 dorm Vicente López',
  'Venta departamento 1 ambiente Retiro',
  'Comprar oficina 50 m2 Microcentro',
  'Alquiler depto 3 ambientes Colegiales',
  'Venta casa estilo chalet San Fernando',
];

const showDebug =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_DEBUG === '1';

type FallbackMode = 'STRICT' | 'RELAX' | 'FEED';

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
  };
}

function normalizePreviewItems(raw: unknown): ListingCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCard).filter((c): c is ListingCard => c !== null);
}

export default function AssistantPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantSearchResponse | null>(null);
  const [saving, setSaving] = useState(false);
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
  const router = useRouter();
  const {
    isSupported: voiceSupported,
    isListening: voiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    start: voiceStart,
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

  // Persistencia: cargar active-search al montar para prefill queryText
  useEffect(() => {
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search?: { queryText?: string | null } }) => {
        const q = data.search?.queryText;
        if (q && typeof q === 'string' && q.trim()) {
          setText(q.trim());
        }
      })
      .catch(() => {});
  }, []);

  async function fetchPreview(
    filters: SearchFilters,
    cursor?: string | null,
    mode: FallbackMode = 'STRICT'
  ): Promise<{ items: ListingCard[]; nextCursor: string | null; finalMode: FallbackMode }> {
    const body: {
      filters: SearchFilters;
      cursor?: string;
      limit?: number;
      fallbackMode?: FallbackMode;
    } = { filters, limit: 10, fallbackMode: mode };
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
        mode === 'STRICT' ? ['RELAX', 'FEED'] : mode === 'RELAX' ? ['FEED'] : [];
      for (const nextMode of modes) {
        const fb = await fetch(`${API_BASE}/assistant/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ filters, limit: 10, fallbackMode: nextMode }),
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
        body: JSON.stringify({ text: q }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? 'Error al buscar');
        return;
      }
      const data = (await res.json()) as AssistantSearchResponse;
      setResult(data);
      setSavedId(null);
      const filters = data.filters ?? {};
      try {
        if (Object.keys(filters).length > 0) {
          const { items, nextCursor, finalMode } = await fetchPreview(filters, null, 'STRICT');
          setPreviewItems(items);
          setPreviewNextCursor(nextCursor);
          setFallbackMode(finalMode);
          setPreviewLoaded(true);
          // Si STRICT devolvió 0, intentar RELAX/FEED en background para mostrar algo
          if (items.length === 0) {
            const {
              items: fallbackItems,
              nextCursor: fallbackNext,
              finalMode: fallbackMode,
            } = await fetchPreview(filters, null, 'RELAX');
            if (fallbackItems.length > 0) {
              setPreviewItems(fallbackItems);
              setPreviewNextCursor(fallbackNext);
              setFallbackMode(fallbackMode);
            } else {
              const { items: feedItems, nextCursor: feedNext } = await fetchPreview(
                filters,
                null,
                'FEED'
              );
              if (feedItems.length > 0) {
                setPreviewItems(feedItems);
                setPreviewNextCursor(feedNext);
                setFallbackMode('FEED');
              }
            }
          }
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
          // Filtros vacíos: cargar catálogo completo para mostrar algo
          const { items, nextCursor: nc } = await fetchPreview({}, null, 'FEED');
          setPreviewItems(items);
          setPreviewNextCursor(nc);
          setFallbackMode('FEED');
          setPreviewLoaded(true);
        }
      } finally {
        // Siempre mostrar la sección de resultados tras una búsqueda exitosa
        setPreviewLoaded(true);
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
    if (pt) next.propertyType = [pt];
    if (op) next.operationType = op;
    return next;
  }

  async function handlePreview(
    cursor?: string | null,
    mode?: FallbackMode,
    filterOverrides?: { propertyType?: string | null; operation?: 'SALE' | 'RENT' | null }
  ) {
    // Permitir cuando result existe (incluso con filters vacío) para Ver similares / Ver catálogo
    if (!result) return;
    const isLoadMore = !!cursor;
    const useMode = mode ?? fallbackMode;
    const filters = getEffectiveFilters(filterOverrides);
    if (isLoadMore) setLoadingMore(true);
    else setLoadingPreview(true);
    setError(null);
    try {
      const { items, nextCursor, finalMode } = await fetchPreview(filters, cursor, useMode);
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

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: text.trim().slice(0, 50) || 'Búsqueda',
          text: text.trim() || undefined,
          filters: result.filters ?? {},
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? 'Error al guardar');
        return;
      }
      const data = (await res.json()) as { id: string };
      setSavedId(data.id);
      const activeRes = await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId: data.id }),
      });
      if (activeRes.ok) {
        setToast('Guardada y activa');
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
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

  const [toast2, setToast2] = useState<string | null>(null);

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

  const handleExampleClick = (example: string) => {
    setText(example);
    handleBuscar(example);
  };

  const showRelaxHint = previewLoaded && previewItems.length === 0 && hasFilters;

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-xl mx-auto space-y-4">
        {showDebug && (
          <p className="text-xs text-gray-400 mb-2">Assistant UI build: {ASSISTANT_BUILD}</p>
        )}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1.5 rounded-xl text-sm font-semibold btn-accent shadow-sm">
            Por texto
          </span>
          <Link
            href="/search"
            className="px-3 py-1.5 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
          >
            Por filtros
          </Link>
          <Link
            href="/search/map"
            className="px-3 py-1.5 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 transition-colors"
          >
            Por mapa
          </Link>
          <Link
            href="/searches"
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] transition-colors"
          >
            Mis búsquedas
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Buscar propiedades</h1>
        <p className="text-slate-600 mb-6">
          Escribí qué buscás y hacé clic en Buscar. Te mostramos resultados al instante.
        </p>

        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Ejemplos — hacé clic para buscar
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleExampleClick(ex)}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-white rounded-full hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 shadow-sm"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <AssistantChatInput
            value={text}
            onChange={setText}
            onSend={() => handleBuscar()}
            loading={loading}
            placeholder="Ej: departamento en Palermo, 2 dormitorios, hasta 100k USD"
            voiceSupported={!!voiceSupported}
            voiceListening={!!voiceListening}
            onVoiceClick={() => {
              voiceHandledRef.current = false;
              voiceStart();
            }}
            maxLength={500}
          />
        </div>
        {voiceError && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm">{voiceError}</p>
          </div>
        )}
        {voiceListening && (
          <p className="mb-4 text-sm text-slate-600 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Escuchando... Decí tu búsqueda.
          </p>
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
          <div className="mt-8 p-5 rounded-2xl bg-white shadow-md border border-slate-100 space-y-4">
            {filtersEmptyButExplained ? (
              <p className="text-sm text-red-600">
                No se detectaron filtros. La explicación indica criterios pero los filtros llegaron
                vacíos.
              </p>
            ) : (
              <p className="text-sm text-slate-700">{result.explanation}</p>
            )}
            {showWarning &&
              result.warnings?.map((w, i) => (
                <p key={i} className="text-amber-600 text-sm">
                  {w}
                </p>
              ))}

            {hasFilters && (
              <>
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm font-medium">Resumen</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyFilters}
                      className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Copiar
                    </button>
                    {showDebug && (
                      <button
                        type="button"
                        onClick={() => setShowJson(!showJson)}
                        className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        {showJson ? 'Ocultar detalles' : 'Ver detalles técnicos'}
                      </button>
                    )}
                  </div>
                </div>
                {showJson ? (
                  <pre className="text-xs bg-white p-3 rounded overflow-auto">
                    {JSON.stringify(result.filters, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-600 bg-white p-3 rounded">{humanSummary}</p>
                )}

                <div className="flex flex-wrap gap-3 items-center mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium shadow-sm hover:shadow disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Guardando...' : 'Guardar búsqueda'}
                  </button>
                  <button
                    onClick={handleActivateAlerts}
                    disabled={!savedId}
                    title={!savedId ? 'Guardá la búsqueda primero para activar alertas' : undefined}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Activar alertas
                  </button>
                  {savedId && (
                    <div className="flex gap-1 p-0.5 bg-slate-100 rounded-xl">
                      <Link
                        href="/feed"
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white shadow text-slate-800"
                      >
                        Ver como Match
                      </Link>
                      <Link
                        href="/feed/list"
                        className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        Ver como lista
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {previewLoaded && (
          <div className="mt-6">
            {fallbackMode === 'RELAX' && previewItems.length > 0 && (
              <p className="text-sm text-amber-700 mb-3">
                No hubo resultados exactos. Mostrando propiedades similares.
              </p>
            )}
            {fallbackMode === 'FEED' && previewItems.length > 0 && (
              <p className="text-sm text-amber-700 mb-3">
                Mostrando catálogo completo (sin filtros).
              </p>
            )}

            <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100/80">
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

            <h2 className="text-lg font-bold text-slate-900 mb-4">Resultados</h2>
            {savedId && previewItems.length > 0 && (
              <div className="flex gap-1 p-0.5 bg-slate-100 rounded-xl w-fit mb-4">
                <Link
                  href="/feed"
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white shadow text-slate-800"
                >
                  Ver como Match
                </Link>
                <Link
                  href="/feed/list"
                  className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Ver como lista
                </Link>
              </div>
            )}
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
                    onClick={() => handlePreview(null, 'RELAX')}
                    disabled={loadingPreview}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {loadingPreview ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Buscando similares...
                      </>
                    ) : (
                      'Ver similares'
                    )}
                  </button>
                  <button
                    onClick={() => handlePreview(null, 'FEED')}
                    disabled={loadingPreview}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Ver catálogo completo
                  </button>
                  <Link
                    href="/feed/list?feed=all"
                    className="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200 transition-colors inline-block"
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
                          {card.heroImageUrl ? (
                            <img
                              src={card.heroImageUrl}
                              alt=""
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-400 text-xs">
                              Sin foto
                            </div>
                          )}
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
