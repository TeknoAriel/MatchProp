'use client';

import Link from 'next/link';

/** Banner para modo prueba: avisa que la función es premium pero permite usarla durante 3-6 meses. */
export default function PremiumGraceBanner({
  variant = 'inline',
  onDismiss,
}: {
  variant?: 'inline' | 'toast';
  onDismiss?: () => void;
}) {
  const content = (
    <>
      <span className="font-medium">Próximamente será premium.</span> Por ahora: uso sin límites
      (período de prueba 3-6 meses).{' '}
      <Link
        href="/me/premium"
        className="underline font-medium hover:no-underline"
        onClick={onDismiss}
      >
        Conocé los planes
      </Link>
    </>
  );

  if (variant === 'toast') {
    return (
      <div
        className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md p-4 rounded-xl bg-[var(--mp-premium)]/90 text-slate-900 text-sm shadow-lg border border-[var(--mp-premium)]"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-lg">ℹ️</span>
          <p>{content}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 p-1 rounded hover:bg-black/10 -mt-1 -mr-1"
              aria-label="Cerrar"
            >
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-[var(--mp-premium)]/15 border border-[var(--mp-premium)]/40 text-slate-800 text-sm">
      <p>{content}</p>
    </div>
  );
}
