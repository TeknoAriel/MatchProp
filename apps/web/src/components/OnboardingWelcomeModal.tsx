'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/** Clave estable para no volver a mostrar el tour en el mismo navegador. */
export const ONBOARDING_STORAGE_KEY = 'matchprop_onboarding_seen_v1';

export default function OnboardingWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
      setOpen(true);
    } catch {
      /* private mode / storage blocked */
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div
        className="w-full sm:max-w-md rounded-t-[var(--mp-radius-card)] sm:rounded-[var(--mp-radius-card)] bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-lg max-h-[90vh] overflow-y-auto safe-area-pb"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--mp-border)] flex items-center justify-between gap-2">
          <h2 id="onboarding-title" className="text-lg font-semibold text-[var(--mp-foreground)]">
            Bienvenido a MatchProp
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="p-2 min-h-[44px] min-w-[44px] rounded-full text-[var(--mp-muted)] hover:bg-[var(--mp-bg)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4 text-sm text-[var(--mp-foreground)] leading-relaxed">
          <p className="text-[var(--mp-muted)]">
            Tres pasos para empezar a matchear propiedades con la IA:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-0.5">
            <li>
              Describí lo que buscás en <strong>Inicio</strong> o en el{' '}
              <Link
                href="/assistant"
                className="text-[var(--mp-accent)] font-medium hover:underline"
              >
                asistente
              </Link>
              .
            </li>
            <li>Guardá la búsqueda y activala para que el feed priorice tus criterios.</li>
            <li>
              En <strong>Match</strong> deslizá para indicar interés; tus likes quedan en guardados.
            </li>
          </ol>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[44px] px-5 rounded-full text-sm font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96]"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
