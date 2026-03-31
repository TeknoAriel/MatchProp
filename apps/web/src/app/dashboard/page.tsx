'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO, SearchFilters } from '@matchprop/shared';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useToast } from '../../components/FunToast';
import { WelcomeMessage, TipBanner } from '../../components/FunTips';
import { recordEngagement } from '../../lib/userEngagementClient';
import { useUserLevel } from '../../hooks/useUserLevel';
import { filtersToHumanSummary } from '../../lib/filters-summary';
import {
  notifyActiveSearchChanged,
  ACTIVE_SEARCH_CHANGED_EVENT,
} from '../../lib/activeSearchEvents';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import OnboardingWelcomeModal from '../../components/OnboardingWelcomeModal';

const API_BASE = '/api';

type ActiveSearchPayload = {
  id: string;
  name: string;
  queryText: string | null;
  filters: SearchFilters;
};

export default function DashboardPage() {
  const router = useRouter();
  const { level, stats } = useUserLevel();
  const [searches, setSearches] = useState<SavedSearchDTO[]>([]);
  const [activeSearch, setActiveSearch] = useState<ActiveSearchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showSuccess } = useToast();

  const fetchSearches = useCallback(() => {
    return fetch(`${API_BASE}/searches`, { credentials: 'include' }).then(async (resSearches) => {
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
    fetchSearches().finally(() => setLoading(false));
  }, [fetchSearches]);

  useEffect(() => {
    fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.firstName) setUserName(data.profile.firstName as string);
      })
      .catch(() => {});
  }, []);

  const syncActiveSearch = useCallback(() => {
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search: ActiveSearchPayload | null }) => {
        setActiveSearch(data.search ?? null);
      })
      .catch(() => setActiveSearch(null));
  }, []);

  useEffect(() => {
    syncActiveSearch();
  }, [syncActiveSearch]);

  useEffect(() => {
    const onSync = () => syncActiveSearch();
    window.addEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onSync);
    return () => window.removeEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onSync);
  }, [syncActiveSearch]);

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
          notifyActiveSearchChanged();
          recordEngagement('search');
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
      notifyActiveSearchChanged();
      showSuccess('Búsqueda activada', '🔍');
    }
  }

  async function handleGoToMatch(searchId: string) {
    await handleSetActive(searchId);
    router.push('/feed');
  }

  const sortedSearches = [...searches].sort((a, b) => {
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return tb - ta;
  });
  const searchSummaryLine = activeSearch
    ? [activeSearch.name?.trim(), filtersToHumanSummary(activeSearch.filters)]
        .filter(Boolean)
        .join(' · ') ||
      activeSearch.queryText?.trim() ||
      null
    : null;
  const showContinueBlock =
    (level === 'ACTIVE' || level === 'ADVANCED') && Boolean(activeSearch && searchSummaryLine);

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="py-4 md:py-6">
      <OnboardingWelcomeModal />
      <div className="-mx-4 md:-mx-6 mb-4">
        <ActiveSearchBar sticky={false} />
      </div>
      <div className="mb-4">
        <WelcomeMessage name={userName} as="h2" />
        <p className="text-sm text-[var(--mp-muted)] mt-1 max-w-xl">
          Describí lo que buscás; la IA arma filtros y te llevamos al match.
        </p>
      </div>
      {showTip && (level === 'NEW' || level === 'ACTIVE') && (
        <div className="mb-6">
          <TipBanner onDismiss={() => setShowTip(false)} />
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mp-accent)] mb-2">
            Buscador asistido
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--mp-foreground)] tracking-tight">
            ¿Qué estás buscando?
          </h1>
          <p className="mt-2 text-sm text-[var(--mp-muted)] max-w-xl">
            Escribí en tus palabras (o por voz); la IA arma filtros y te llevamos al match. Para
            afinar paso a paso usá{' '}
            <Link href="/assistant" className="text-[var(--mp-accent)] font-medium hover:underline">
              el asistente
            </Link>
            .
          </p>
        </div>
        <Link
          href="/me/saved"
          className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full border border-[var(--mp-border)] bg-[var(--mp-card)] text-lg hover:border-[var(--mp-accent)]/40 hover:bg-[var(--mp-bg)] transition-colors"
          title="Guardados"
          aria-label="Ir a guardados"
        >
          ⭐
        </Link>
      </div>

      {level === 'ADVANCED' && (
        <nav
          className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[var(--mp-muted)] border-b border-[var(--mp-border)] pb-4"
          aria-label="Accesos rápidos"
        >
          <Link
            href="/me/saved"
            className="font-medium text-[var(--mp-foreground)] hover:text-[var(--mp-accent)]"
          >
            Guardados
          </Link>
          <span className="text-[var(--mp-border)]" aria-hidden>
            ·
          </span>
          <Link
            href="/searches"
            className="font-medium text-[var(--mp-foreground)] hover:text-[var(--mp-accent)]"
          >
            Búsquedas
          </Link>
          <span className="text-[var(--mp-border)]" aria-hidden>
            ·
          </span>
          <Link
            href="/feed"
            className="font-medium text-[var(--mp-foreground)] hover:text-[var(--mp-accent)]"
          >
            Match
          </Link>
          <span className="text-[var(--mp-border)]" aria-hidden>
            ·
          </span>
          <Link
            href="/feed/list"
            className="font-medium text-[var(--mp-foreground)] hover:text-[var(--mp-accent)]"
          >
            Lista
          </Link>
        </nav>
      )}

      <div className="mb-10">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: casa 3 dormitorios en Funes hasta 150mil USD"
            disabled={searching || isListening}
            className="w-full px-4 py-4 pr-24 text-base rounded-[var(--mp-radius-card)] border border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)] placeholder:text-[var(--mp-muted)] focus:border-[var(--mp-accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--mp-accent)_25%,transparent)] transition-colors disabled:opacity-60"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                disabled={searching}
                className={`p-2.5 rounded-[var(--mp-radius-chip)] transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:bg-[color-mix(in_srgb,var(--mp-accent)_12%,var(--mp-bg))] hover:text-[var(--mp-accent-hover)]'
                }`}
                aria-label={isListening ? 'Detener micrófono' : 'Buscar por voz'}
              >
                🎤
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={searching || !searchText.trim() || searchText.length < 3}
              className="p-2.5 rounded-[var(--mp-radius-chip)] bg-[var(--mp-accent)] text-white hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Buscar"
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
          <p className="mt-3 text-sm text-[var(--mp-accent)] flex items-center gap-2 font-medium">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Escuchando… decí lo que buscás
          </p>
        )}

        <Link
          href="/assistant"
          className="mt-6 flex items-center gap-3 w-full p-4 rounded-[var(--mp-radius-card)] border border-[var(--mp-border)] bg-[var(--mp-card)] hover:border-[color-mix(in_srgb,var(--mp-accent)_35%,var(--mp-border))] transition-colors text-left"
        >
          <span className="text-2xl shrink-0" aria-hidden>
            ✨
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--mp-foreground)]">Asistente con IA</p>
            <p className="text-xs text-[var(--mp-muted)] mt-0.5">
              Filtros finos, vista previa y más control sobre tu búsqueda.
            </p>
          </div>
          <span className="text-[var(--mp-muted)] text-sm shrink-0 ml-auto" aria-hidden>
            →
          </span>
        </Link>

        {showContinueBlock && activeSearch && searchSummaryLine && (
          <section
            className="mt-6 p-4 rounded-[var(--mp-radius-card)] border border-[var(--mp-border)] bg-[color-mix(in_srgb,var(--mp-accent)_6%,var(--mp-card))]"
            aria-labelledby="dashboard-continue-heading"
          >
            <p
              id="dashboard-continue-heading"
              className="text-[10px] font-bold uppercase tracking-wider text-[var(--mp-muted)] mb-2"
            >
              Seguí donde estabas
            </p>
            <p className="text-sm text-[var(--mp-foreground)]">
              {stats.listingOpens} {stats.listingOpens === 1 ? 'vista' : 'vistas'} · {stats.saves}{' '}
              {stats.saves === 1 ? 'guardada' : 'guardadas'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/feed"
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96]"
              >
                Continuar en Match
              </Link>
              <Link
                href={`/searches/${activeSearch.id}`}
                className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full text-sm font-medium border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
              >
                Ver resultados
              </Link>
            </div>
          </section>
        )}

        {level === 'ACTIVE' && !showContinueBlock && sortedSearches.length > 0 && (
          <p className="mt-4 text-xs text-[var(--mp-muted)]">
            <span className="font-medium text-[var(--mp-foreground)]">Reciente: </span>
            <button
              type="button"
              className="text-[var(--mp-accent)] hover:underline font-medium"
              onClick={() => void handleGoToMatch(sortedSearches[0]!.id)}
            >
              {sortedSearches[0]!.name || sortedSearches[0]!.queryText?.slice(0, 40) || 'Búsqueda'}
            </button>
            {sortedSearches.length > 1 && (
              <>
                <span> · </span>
                <button
                  type="button"
                  className="text-[var(--mp-accent)] hover:underline font-medium"
                  onClick={() => void handleGoToMatch(sortedSearches[1]!.id)}
                >
                  {sortedSearches[1]!.name || sortedSearches[1]!.queryText?.slice(0, 32) || 'Otra'}
                </button>
              </>
            )}
            <span className="text-[var(--mp-muted)]"> · </span>
            <Link href="/searches" className="text-[var(--mp-foreground)] hover:underline">
              Todas
            </Link>
          </p>
        )}

        {level !== 'ADVANCED' && (
          <div className="mt-8">
            <Link
              href="/feed"
              className="inline-flex items-center justify-center w-full sm:w-auto min-h-[52px] px-8 rounded-full font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] transition-opacity"
            >
              Explorar propiedades
            </Link>
          </div>
        )}

        {sortedSearches.length > 0 && (
          <section
            className="mt-10 pt-8 border-t border-[var(--mp-border)]"
            aria-labelledby="dashboard-saved-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <h2
                  id="dashboard-saved-heading"
                  className="text-lg font-semibold text-[var(--mp-foreground)]"
                >
                  Mis búsquedas
                </h2>
                <p className="text-xs text-[var(--mp-muted)] mt-1">
                  Activá una búsqueda y abrí match; las alertas se gestionan desde cada búsqueda o
                  en Alertas.
                </p>
              </div>
              <Link
                href="/searches"
                className="text-sm font-semibold text-[var(--mp-accent)] hover:underline shrink-0"
              >
                Gestionar todo →
              </Link>
            </div>
            <ul className="space-y-2">
              {sortedSearches.slice(0, 5).map((s) => {
                const isActive = activeSearch?.id === s.id;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-2 justify-between rounded-[var(--mp-radius-card)] border border-[var(--mp-border)] bg-[var(--mp-card)] px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--mp-foreground)] truncate">
                        {s.name || s.queryText?.slice(0, 56) || 'Sin nombre'}
                      </p>
                      {isActive && (
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--mp-accent)]">
                          Activa ahora
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => void handleSetActive(s.id)}
                          className="min-h-[40px] px-3 rounded-full text-xs font-semibold border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleGoToMatch(s.id)}
                        className="min-h-[40px] px-4 rounded-full text-xs font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96]"
                      >
                        Ir a Match
                      </button>
                      <Link
                        href={`/searches/${s.id}`}
                        className="inline-flex items-center min-h-[40px] px-3 rounded-full text-xs font-medium text-[var(--mp-accent)] hover:underline"
                      >
                        Detalle
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
            {sortedSearches.length > 5 && (
              <p className="text-xs text-[var(--mp-muted)] mt-3">
                Mostrando 5 de {sortedSearches.length}.{' '}
                <Link
                  href="/searches"
                  className="text-[var(--mp-accent)] font-medium hover:underline"
                >
                  Ver todas y alertas
                </Link>
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
