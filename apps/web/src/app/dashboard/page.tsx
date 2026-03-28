'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useToast } from '../../components/FunToast';

const API_BASE = '/api';

const EXAMPLE_QUERIES = [
  'PH 2 amb en Palermo',
  'Casa en venta Funes',
  'Depto alquiler Rosario centro',
];

export default function DashboardPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
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
    else if (res.ok) showSuccess('Búsqueda activada', '🔍');
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
  const recentForHint = sortedSearches.slice(0, 2);

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="py-4 md:py-6">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mp-accent)] mb-2">
          Buscador asistido
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--mp-foreground)] tracking-tight">
          ¿Qué estás buscando?
        </h1>
      </div>

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

        <p className="mt-4 text-xs text-[var(--mp-muted)] leading-relaxed">
          Ideas rápidas:{' '}
          {EXAMPLE_QUERIES.map((q, i) => (
            <span key={q}>
              {i > 0 ? ' · ' : null}
              <button
                type="button"
                className="text-[var(--mp-foreground)] font-medium hover:text-[var(--mp-accent)] hover:underline"
                onClick={() => {
                  setSearchText(q);
                  inputRef.current?.focus();
                }}
              >
                {q}
              </button>
            </span>
          ))}
        </p>

        {recentForHint.length > 0 && (
          <p className="mt-3 text-xs text-[var(--mp-muted)]">
            Seguí con:{' '}
            {recentForHint.map((s, i) => (
              <span key={s.id}>
                {i > 0 ? ' · ' : null}
                <button
                  type="button"
                  className="font-medium text-[var(--mp-accent)] hover:underline"
                  onClick={() => void handleGoToMatch(s.id)}
                >
                  {s.name || s.queryText?.slice(0, 40) || 'Búsqueda'}
                </button>
              </span>
            ))}
            <span className="text-[var(--mp-muted)]"> · </span>
            <Link href="/searches" className="text-[var(--mp-foreground)] hover:underline">
              Gestionar búsquedas
            </Link>
          </p>
        )}

        <div className="mt-10">
          <Link
            href="/feed"
            className="inline-flex items-center justify-center w-full sm:w-auto min-h-[52px] px-8 rounded-full font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] transition-opacity"
          >
            Ir a Match
          </Link>
        </div>
      </div>
    </main>
  );
}
