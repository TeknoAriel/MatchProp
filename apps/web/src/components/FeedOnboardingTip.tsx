'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/** Tour opcional Sprint 7: una sola vez por navegador, sin modal bloqueante. */
const STORAGE_KEY = 'matchprop_feed_tip_v1';

export default function FeedOnboardingTip() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      setOpen(true);
    } catch {
      /* private mode */
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="mb-3 px-3 py-2.5 rounded-xl border border-[var(--mp-accent)]/25 bg-[color-mix(in_srgb,var(--mp-accent)_7%,var(--mp-card))] text-left shadow-sm"
      role="status"
    >
      <p className="text-[13px] sm:text-sm text-[var(--mp-foreground)] leading-snug">
        <span className="font-semibold text-[var(--mp-accent)]">Tip:</span> describí lo que buscás en{' '}
        <Link href="/dashboard" className="text-[var(--mp-accent)] font-medium underline-offset-2 hover:underline">
          Inicio
        </Link>{' '}
        o en el{' '}
        <Link
          href="/assistant"
          className="text-[var(--mp-accent)] font-medium underline-offset-2 hover:underline"
        >
          asistente
        </Link>
        , guardá la búsqueda y volvé acá: te mostramos propiedades alineadas a tus criterios.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-xs font-medium text-[var(--mp-muted)] hover:text-[var(--mp-foreground)]"
      >
        Entendido
      </button>
    </div>
  );
}
