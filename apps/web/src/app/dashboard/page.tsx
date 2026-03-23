'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { WelcomeMessage, TipBanner } from '../../components/FunTips';
import { useToast } from '../../components/FunToast';
import SavedSearchCard, {
  EditSearchModal,
  type AlertTypeSaved,
  type SubStateSaved,
  type AlertDeliverySaved,
} from '../../components/SavedSearchCard';

const API_BASE = '/api';

type AlertType = AlertTypeSaved;
type SubState = SubStateSaved;
type AlertDelivery = AlertDeliverySaved;

type AlertSubscription = {
  id: string;
  savedSearchId: string | null;
  savedSearchName: string | null;
  savedSearchQueryText?: string | null;
  type: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
};

const ALERT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  NEW_LISTING: { label: 'Nuevas publicaciones', icon: '🏠' },
  PRICE_DROP: { label: 'Bajó el precio', icon: '📉' },
  BACK_ON_MARKET: { label: 'Volvió al mercado', icon: '🔄' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearchDTO[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [subsBySearch, setSubsBySearch] = useState<Record<string, Record<AlertType, SubState>>>({});
  const [deliveriesBySearch, setDeliveriesBySearch] = useState<Record<string, AlertDelivery[]>>({});
  const [showMoreSearches, setShowMoreSearches] = useState(false);
  const [alerts, setAlerts] = useState<AlertSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showSuccess } = useToast();

  const fetchSearches = useCallback(() => {
    return Promise.all([
      fetch(`${API_BASE}/searches`, { credentials: 'include' }),
      fetch(`${API_BASE}/me/active-search`, { credentials: 'include' }),
    ]).then(async ([resSearches, resActive]) => {
      if (resSearches.status === 401) {
        router.replace('/login');
        setSearches([]);
        return;
      }
      if (!resSearches.ok) {
        setSearches([]);
        return;
      }
      const raw = await resSearches.json();
      const list = Array.isArray(raw) ? raw : (raw?.searches ?? []);
      setSearches(list);
      const activeData = resActive.ok ? await resActive.json() : {};
      setActiveSearchId(activeData.search?.id ?? null);
    });
  }, [router]);

  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition('es-AR');

  useEffect(() => {
    if (transcript && !isListening) {
      setSearchText(transcript);
      handleSearch(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    if (isListening) {
      setSearchText(transcript + (interimTranscript ? ' ' + interimTranscript : ''));
    }
  }, [isListening, transcript, interimTranscript]);

  useEffect(() => {
    Promise.all([
      fetchSearches(),
      fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' }).then(async (res) => {
        if (res.status === 401) return [];
        if (res.ok) return res.json();
        return [];
      }),
    ])
      .then(([, alertsList]) => {
        setAlerts(alertsList ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Obtener nombre del usuario
    fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.firstName) {
          setUserName(data.profile.firstName);
        }
      })
      .catch(() => {});
  }, [router, fetchSearches]);

  useEffect(() => {
    if (searches.length === 0) return;
    const ids = searches.map((s) => s.id);
    Promise.all([
      fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      ),
      ...ids.map((id) =>
        fetch(`${API_BASE}/alerts/deliveries/by-search/${id}?limit=5`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : { deliveries: [] }))
      ),
    ]).then(([subsList, ...deliveryResults]) => {
      const subsMap: Record<string, Record<AlertType, SubState>> = {};
      ids.forEach((id) => {
        subsMap[id] = {
          NEW_LISTING: null,
          PRICE_DROP: null,
          BACK_ON_MARKET: null,
        };
      });
      for (const s of subsList ?? []) {
        if (s.savedSearchId && ids.includes(s.savedSearchId)) {
          const t = s.type as AlertType;
          if (t in subsMap[s.savedSearchId]!) {
            subsMap[s.savedSearchId]![t] = { id: s.id, isEnabled: s.isEnabled };
          }
        }
      }
      setSubsBySearch(subsMap);

      const delMap: Record<string, AlertDelivery[]> = {};
      ids.forEach((id, i) => {
        const d = deliveryResults[i] as { deliveries?: AlertDelivery[] };
        delMap[id] = d?.deliveries ?? [];
      });
      setDeliveriesBySearch(delMap);
    });
  }, [searches]);

  async function handleSearch(text?: string) {
    const query = (text ?? searchText).trim();
    if (!query || query.length < 3) return;

    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/assistant/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: query }),
      });

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const saveRes = await fetch(`${API_BASE}/searches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: query.slice(0, 50),
            text: query,
            filters: data.filters,
          }),
        });

        if (saveRes.ok) {
          const saved = await saveRes.json();
          await fetch(`${API_BASE}/me/active-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ searchId: saved.id }),
          });
          router.push('/feed');
        }
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleSetActive(searchId: string) {
    const res = await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId }),
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) {
      setActiveSearchId(searchId);
      showSuccess('Búsqueda activada', '🔍');
    }
  }

  async function handleMatch(searchId: string) {
    await handleSetActive(searchId);
    router.push('/feed');
  }

  function handleEditOpen(s: SavedSearchDTO) {
    setEditingId(s.id);
    setEditName(s.name || '');
    setEditText(s.queryText || '');
  }

  async function handleEditSave() {
    if (!editingId || editSaving) return;
    setEditSaving(true);
    try {
      let body: { name?: string; text?: string; filters?: unknown } = {
        name: editName.trim() || undefined,
      };
      if (editText.trim().length >= 3) {
        const parseRes = await fetch(`${API_BASE}/assistant/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: editText.trim() }),
        });
        if (parseRes.ok) {
          const parsed = await parseRes.json();
          body = { ...body, text: editText.trim(), filters: parsed.filters };
        }
      }
      const res = await fetch(`${API_BASE}/searches/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        await fetchSearches();
        setEditingId(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(searchId: string) {
    const res = await fetch(`${API_BASE}/searches/${searchId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) {
      setSearches((prev) => prev.filter((s) => s.id !== searchId));
      setDeleteConfirmId(null);
      if (activeSearchId === searchId) setActiveSearchId(null);
    }
  }

  async function handleAlert(searchId: string, type: AlertType, enable: boolean) {
    const sub = subsBySearch[searchId]?.[type];
    if (sub) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: enable }),
      });
      if (res.ok) {
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? {
            NEW_LISTING: null,
            PRICE_DROP: null,
            BACK_ON_MARKET: null,
          };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING:
              type === 'NEW_LISTING' ? { ...sub, isEnabled: enable } : (base.NEW_LISTING ?? null),
            PRICE_DROP:
              type === 'PRICE_DROP' ? { ...sub, isEnabled: enable } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET:
              type === 'BACK_ON_MARKET'
                ? { ...sub, isEnabled: enable }
                : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    } else if (enable) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: searchId, type }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? {
            NEW_LISTING: null,
            PRICE_DROP: null,
            BACK_ON_MARKET: null,
          };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING:
              type === 'NEW_LISTING'
                ? { id: data.id, isEnabled: true }
                : (base.NEW_LISTING ?? null),
            PRICE_DROP:
              type === 'PRICE_DROP' ? { id: data.id, isEnabled: true } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET:
              type === 'BACK_ON_MARKET'
                ? { id: data.id, isEnabled: true }
                : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    }
  }

  const primarySearch = searches.find((s) => s.id === activeSearchId) ?? searches[0] ?? null;
  const restSearches = primarySearch ? searches.filter((s) => s.id !== primarySearch.id) : [];

  const savedSearchCardProps = (s: SavedSearchDTO) => ({
    s,
    activeSearchId,
    expandedId,
    onToggleExpand: (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    deleteConfirmId,
    setDeleteConfirmId,
    subsBySearch,
    deliveriesBySearch,
    onMatch: handleMatch,
    onEditOpen: handleEditOpen,
    onSetActive: handleSetActive,
    onDelete: handleDelete,
    onAlert: handleAlert,
  });

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="py-2">
      {/* Header con saludo personalizado */}
      <div className="mb-6">
        <WelcomeMessage name={userName} />
        <p className="text-[var(--mp-muted)] text-sm mt-1">
          Describí lo que buscás y te mostramos los matches ✨
        </p>
      </div>

      {/* Tip aleatorio */}
      {showTip && <TipBanner onDismiss={() => setShowTip(false)} />}

      {/* Buscador principal */}
      <div className="mb-8">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: casa 3 dormitorios en Funes hasta 150mil USD"
            disabled={searching || isListening}
            className="w-full px-4 py-4 pr-24 text-base rounded-2xl border-2 border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)] placeholder:text-[var(--mp-muted)] focus:border-sky-500 focus:outline-none transition-colors disabled:opacity-60"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                disabled={searching}
                className={`p-2.5 rounded-xl transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:bg-sky-100 hover:text-sky-600'
                }`}
              >
                🎤
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={searching || !searchText.trim() || searchText.length < 3}
              className="p-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {searching ? (
                <span className="w-5 h-5 block border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                '🔍'
              )}
            </button>
          </div>
        </div>

        {isListening && (
          <p className="mt-2 text-sm text-sky-600 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Escuchando... Decí lo que buscás
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {['Casa en venta', 'Depto alquiler', 'Terreno', 'Con pileta'].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setSearchText(suggestion);
                inputRef.current?.focus();
              }}
              className="px-3 py-1.5 text-sm rounded-full bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:bg-sky-50 hover:text-sky-600 border border-[var(--mp-border)] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Mis búsquedas — búsqueda activa (o la primera) + Ver más con misma UX que /searches */}
      {primarySearch && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--mp-foreground)]">Mis búsquedas</h2>
            <Link href="/searches" className="text-sm text-sky-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            <SavedSearchCard {...savedSearchCardProps(primarySearch)} />
            {restSearches.length > 0 && (
              <>
                {!showMoreSearches ? (
                <button
                  type="button"
                    onClick={() => setShowMoreSearches(true)}
                    className="w-full py-3 text-center text-sm text-sky-600 hover:text-sky-700 font-medium rounded-2xl border border-dashed border-[var(--mp-border)] hover:border-sky-300"
                >
                    Ver más ({restSearches.length})
                </button>
                ) : (
                  <>
                    {restSearches.map((s) => (
                      <SavedSearchCard key={s.id} {...savedSearchCardProps(s)} />
                    ))}
                <button
                  type="button"
                      onClick={() => setShowMoreSearches(false)}
                      className="w-full py-2 text-center text-sm text-[var(--mp-muted)] hover:underline"
                    >
                      Ver menos
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mis match — botón alargado: likes → favoritos → resultados búsquedas */}
      <Link
        href="/me/match"
        className="block w-full p-4 mb-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:shadow-xl transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold opacity-95">Mis match</p>
            <p className="text-xs opacity-80 mt-0.5">
              Likes 👍 → Favoritos ★ → Resultados de búsquedas guardadas
            </p>
          </div>
          <span className="text-4xl">🔥</span>
        </div>
      </Link>

      {/* Mis alertas — destacado */}
      <Link
        href="/alerts"
        className="block w-full p-4 mb-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold opacity-95">Mis alertas</p>
            <p className="text-xs opacity-80 mt-0.5">Resultado de todas las alertas activas</p>
          </div>
          <span className="text-4xl">🔔</span>
        </div>
      </Link>

      {/* Detalle de alertas activas */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--mp-foreground)]">Alertas activas</h2>
            <Link href="/alerts" className="text-sm text-sky-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => {
              const typeInfo = ALERT_TYPE_LABELS[alert.type] ?? {
                label: alert.type,
                icon: '🔔',
              };
              return (
                <Link
                  key={alert.id}
                  href="/alerts"
                  className="block p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-sky-600">
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <p className="text-sm text-[var(--mp-foreground)] truncate mt-0.5">
                        {alert.savedSearchQueryText || alert.savedSearchName || 'Búsqueda guardada'}
                      </p>
                      <p className="text-xs text-[var(--mp-muted)] mt-0.5">
                        {alert.isEnabled ? '✓ Activa' : '⏸ Pausada'}
                      </p>
                    </div>
                    <span className="ml-3 text-sky-500">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state + Motivational */}
      {searches.length === 0 && alerts.length === 0 && (
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center">
            <span className="text-4xl animate-float">🏠</span>
          </div>
          <h3 className="font-semibold text-lg text-[var(--mp-foreground)] mb-2">
            ¡Tu próximo hogar te espera! ✨
          </h3>
          <p className="text-sm text-[var(--mp-muted)] mb-6">
            Escribí arriba qué tipo de propiedad buscás
            <br />y te mostramos los matches perfectos
          </p>
              </div>
      )}

      {/* Accesos rápidos — solo en mobile (web tiene sidebar) */}
      <div className="md:hidden mt-8 pt-6 border-t border-[var(--mp-border)]">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/feed"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">🔥</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Match</span>
          </Link>
          <Link
            href="/searches"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">📁</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Búsquedas</span>
          </Link>
          <Link
            href="/alerts"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">🔔</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Alertas</span>
          </Link>
          <Link
            href="/feed/list"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">📋</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Lista</span>
          </Link>
          <Link
            href="/search/map"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">🗺️</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Mapa</span>
          </Link>
          <Link
            href="/me/saved"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">⭐</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Favoritos</span>
          </Link>
        </div>
      </div>

      <EditSearchModal
        open={!!editingId}
        editName={editName}
        editText={editText}
        editSaving={editSaving}
        onEditName={setEditName}
        onEditText={setEditText}
        onSave={handleEditSave}
        onClose={() => setEditingId(null)}
      />
    </main>
  );
}
