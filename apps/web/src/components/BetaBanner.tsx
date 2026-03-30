/**
 * Franja visible cuando NEXT_PUBLIC_BETA=1 (oleada beta en producción/staging).
 */
export function BetaBanner() {
  if (process.env.NEXT_PUBLIC_BETA !== '1') return null;
  const feedback = process.env.NEXT_PUBLIC_BETA_FEEDBACK_URL?.trim();
  return (
    <div
      className="sticky top-0 z-[100] w-full border-b border-amber-400/40 bg-amber-500/95 text-amber-950 px-3 py-2 text-center text-sm font-medium shadow-sm"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>Versión beta — estamos mejorando con tu ayuda.</span>
        {feedback ? (
          <a
            href={feedback}
            className="underline underline-offset-2 hover:opacity-90 font-semibold"
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar feedback
          </a>
        ) : (
          <span className="text-amber-900/90">
            Contanos qué te gustaría mejorar desde Configuraciones o soporte.
          </span>
        )}
      </span>
    </div>
  );
}
