'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import { filtersToHumanSummary } from '../../lib/filters-summary';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

const API_BASE = '/api';

export default function DashboardPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [recentMatches, setRecentMatches] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
    fetch(`${API_BASE}/searches`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (res.ok) {
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : raw?.searches ?? [];
          setSearches(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`${API_BASE}/feed?limit=1`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.total) setRecentMatches(data.total);
      })
      .catch(() => {});
  }, [router]);

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

  async function activateSearch(searchId: string) {
    await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId }),
    });
    router.push('/feed');
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="py-2">
      {/* Header con saludo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">
          ¿Qué estás buscando?
        </h1>
        <p className="text-[var(--mp-muted)] text-sm mt-1">
          Describí tu búsqueda y te mostramos los matches
        </p>
      </div>

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

      {/* Stats rápidos */}
      {recentMatches > 0 && (
        <Link 
          href="/feed"
          className="block mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Propiedades disponibles</p>
              <p className="text-2xl font-bold">{recentMatches.toLocaleString()}</p>
            </div>
            <span className="text-3xl">🔥</span>
          </div>
          <p className="text-sm opacity-75 mt-1">Ver matches →</p>
        </Link>
      )}

      {/* Mis búsquedas */}
      {searches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--mp-foreground)]">
              Mis búsquedas
            </h2>
            <Link 
              href="/searches" 
              className="text-sm text-sky-600 hover:underline"
            >
              Ver todas
            </Link>
          </div>

          <div className="space-y-2">
            {searches.slice(0, 5).map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => activateSearch(search.id)}
                className="w-full p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 hover:shadow-sm text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-[var(--mp-foreground)] truncate">
                      {search.name || 'Búsqueda guardada'}
                    </h3>
                    {search.filters && Object.keys(search.filters).length > 0 && (
                      <p className="text-sm text-[var(--mp-muted)] truncate mt-0.5">
                        {filtersToHumanSummary(search.filters)}
                      </p>
                    )}
                  </div>
                  <span className="ml-3 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {searches.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sky-50 flex items-center justify-center">
            <span className="text-2xl">🏠</span>
          </div>
          <h3 className="font-medium text-[var(--mp-foreground)] mb-1">
            Empezá tu búsqueda
          </h3>
          <p className="text-sm text-[var(--mp-muted)]">
            Escribí arriba qué tipo de propiedad buscás<br />
            y te mostramos los matches
          </p>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="mt-8 pt-6 border-t border-[var(--mp-border)]">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/feed"
            className="p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] hover:border-sky-300 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">🔥</span>
            <span className="text-sm font-medium text-[var(--mp-foreground)]">Match</span>
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
    </main>
  );
}
