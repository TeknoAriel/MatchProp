'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notifyActiveSearchChanged, ACTIVE_SEARCH_CHANGED_EVENT } from '../lib/activeSearchEvents';
import { buildBuscandoLine } from '../lib/active-search-label';
import { useUserLevel } from '../hooks/useUserLevel';
import type { SearchFilters, UserEngagementStats, UserLevel } from '@matchprop/shared';

const API_BASE = '/api';

export type ActiveSearchState = {
  id: string;
  name: string;
  queryText: string | null;
  filters: SearchFilters;
  updatedAt: string;
} | null;

/** Clave estable: solo cambia al cruzar umbrales (evita parpadeo de sugerencias). */
function stableTipKey(stats: UserEngagementStats, hasSearch: boolean): string | null {
  if (!hasSearch) return null;
  const { swipes, saves } = stats;
  if (swipes >= 10 && saves <= 1) return 'high_swipes_low_saves';
  if (saves >= 5) return 'many_saves';
  if (swipes >= 6 && saves >= 2 && saves < 5) return 'balanced';
  return null;
}

const TIP_BY_KEY: Record<string, string> = {
  high_swipes_low_saves: 'Muchas vistas, pocos guardados: probá afinar precio o zona con Ajustar.',
  many_saves: 'Tenés varios guardados: revisalos en ⭐ cuando quieras.',
  balanced: 'Buen ritmo: el asistente puede afinar filtros si querés más precisión.',
};

function continuityLine(
  level: UserLevel,
  stats: UserEngagementStats,
  hasSearch: boolean
): string | null {
  if (!hasSearch || level === 'NEW') return null;
  if (stats.listingOpens <= 0 && stats.saves <= 0) return null;
  return `${stats.listingOpens} ${stats.listingOpens === 1 ? 'vista' : 'vistas'} · ${stats.saves} ${stats.saves === 1 ? 'guardada' : 'guardadas'}`;
}

type ActiveSearchBarProps = {
  sticky?: boolean;
  className?: string;
};

export default function ActiveSearchBar({ sticky = true, className = '' }: ActiveSearchBarProps) {
  const router = useRouter();
  const { level, stats } = useUserLevel();
  const [search, setSearch] = useState<ActiveSearchState>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'clear' | 'new' | null>(null);
  const lastTipKeyRef = useRef<string | null>(null);
  const [stableTipText, setStableTipText] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch(`${API_BASE}/me/active-search`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { search: null }))
      .then((data: { search: ActiveSearchState }) => setSearch(data.search))
      .catch(() => setSearch(null))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load(true);
    window.addEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onRefresh);
    return () => window.removeEventListener(ACTIVE_SEARCH_CHANGED_EVENT, onRefresh);
  }, [load]);

  const hasSearch = Boolean(search);

  useEffect(() => {
    const key = stableTipKey(stats, hasSearch);
    if (!key) {
      if (lastTipKeyRef.current !== null) {
        lastTipKeyRef.current = null;
        setStableTipText(null);
      }
      return;
    }
    if (key !== lastTipKeyRef.current) {
      lastTipKeyRef.current = key;
      setStableTipText(TIP_BY_KEY[key] ?? null);
    }
  }, [stats.swipes, stats.saves, hasSearch]);

  async function postClear() {
    const res = await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId: null }),
    });
    if (res.ok) {
      setSearch(null);
      notifyActiveSearchChanged();
    }
  }

  async function handleLimpiar() {
    setBusy('clear');
    try {
      await postClear();
    } finally {
      setBusy(null);
    }
  }

  async function handleNueva() {
    setBusy('new');
    try {
      await postClear();
      router.push('/dashboard');
    } finally {
      setBusy(null);
    }
  }

  const adjustHref = hasSearch ? '/assistant?focus=input&from=active' : '/assistant?focus=input';

  const cont = continuityLine(level, stats, hasSearch);
  const subline =
    stableTipText != null
      ? { kind: 'tip' as const, text: stableTipText }
      : cont != null && (level === 'ACTIVE' || level === 'ADVANCED')
        ? { kind: 'continuity' as const, text: cont }
        : null;

  const stickyClass = sticky ? 'sticky top-0 z-[15]' : '';

  if (loading) {
    return (
      <div
        className={`${stickyClass} bg-[var(--mp-card)] border-b border-[var(--mp-border)] transition-opacity duration-300 ${className}`}
      >
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-2 h-[52px] flex items-center">
          <div className="h-8 w-full bg-[var(--mp-bg)] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${stickyClass} bg-[var(--mp-card)]/95 backdrop-blur-md border-b border-[var(--mp-border)] shadow-sm transition-[box-shadow,background-color] duration-300 ease-out ${className}`}
    >
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-2 min-h-[52px] flex flex-col justify-center gap-1">
        {!search ? (
          <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--mp-muted)] leading-none mb-0.5">
                Buscando
              </p>
              <p className="text-sm font-medium text-[var(--mp-foreground)] truncate">
                Sin búsqueda activa
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <Link
                href="/dashboard"
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] transition-opacity"
              >
                Definir
              </Link>
              <Link
                href={adjustHref}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--mp-accent)] hover:bg-[color-mix(in_srgb,var(--mp-accent)_10%,transparent)] transition-colors"
              >
                Ajustar
              </Link>
              {(level === 'ACTIVE' || level === 'ADVANCED') && (
                <Link
                  href="/feed?feed=all"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] transition-colors"
                >
                  Explorar
                </Link>
              )}
              {level === 'ADVANCED' && (
                <Link
                  href="/search"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] transition-colors"
                >
                  Filtros
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-2 gap-y-1.5">
              <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--mp-muted)] leading-none mb-0.5">
                  Buscando
                </p>
                <p
                  className="text-sm font-semibold text-[var(--mp-foreground)] leading-tight line-clamp-1"
                  title={buildBuscandoLine(search)}
                >
                  {buildBuscandoLine(search)}
                </p>
              </div>
              <div
                className="flex flex-wrap items-center gap-1 shrink-0"
                role="toolbar"
                aria-label="Acciones de búsqueda activa"
              >
                <Link
                  href={adjustHref}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--mp-accent)] hover:bg-[color-mix(in_srgb,var(--mp-accent)_10%,transparent)] transition-colors"
                >
                  Ajustar
                </Link>
                {(level === 'ACTIVE' || level === 'ADVANCED') && (
                  <button
                    type="button"
                    onClick={() => void handleLimpiar()}
                    disabled={busy !== null}
                    title="Quitar búsqueda activa (seguís en esta pantalla)"
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs text-[var(--mp-muted)] hover:text-red-600 hover:bg-red-500/5 disabled:opacity-50 transition-colors"
                  >
                    {busy === 'clear' ? '…' : 'Limpiar'}
                  </button>
                )}
                {level === 'ADVANCED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleNueva()}
                      disabled={busy !== null}
                      title="Empezar una búsqueda nueva desde el inicio"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--mp-foreground)] border border-[var(--mp-border)] hover:bg-[var(--mp-bg)] disabled:opacity-50 transition-colors"
                    >
                      {busy === 'new' ? '…' : 'Nueva'}
                    </button>
                    <Link
                      href="/search"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] transition-colors"
                    >
                      Filtros
                    </Link>
                  </>
                )}
              </div>
            </div>
            {subline && (
              <p
                className={`text-[11px] leading-snug truncate pl-0.5 transition-opacity duration-300 ${
                  subline.kind === 'tip' ? 'text-[var(--mp-accent)]/90' : 'text-[var(--mp-muted)]'
                }`}
                title={subline.text}
              >
                {subline.kind === 'tip' ? <span aria-hidden>✨ </span> : null}
                {subline.text}
              </p>
            )}
            <div
              className="h-px rounded-full bg-[var(--mp-border)] overflow-hidden opacity-80"
              aria-hidden
            >
              <div
                className="h-full bg-[var(--mp-accent)]/45 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.min(100, 6 + stats.swipes * 2 + stats.saves * 4)}%`,
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
