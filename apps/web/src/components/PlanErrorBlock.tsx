'use client';

import Link from 'next/link';

interface PlanErrorBlockProps {
  message: string;
  /** Si true, muestra el botón Ver planes. Si no se pasa, se infiere del mensaje (plan, premium, Agente) */
  showPremiumCta?: boolean;
  /** Clases adicionales para el contenedor */
  className?: string;
}

function isPlanRelatedError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('plan') ||
    lower.includes('premium') ||
    lower.includes('agente') ||
    lower.includes('crear lista') ||
    lower.includes('compartir')
  );
}

/**
 * Bloque de error por restricción de plan/negocio.
 * Incluye CTA "Ver planes" para facilitar la contratación.
 */
export default function PlanErrorBlock({
  message,
  showPremiumCta,
  className = '',
}: PlanErrorBlockProps) {
  const showCta = showPremiumCta ?? isPlanRelatedError(message);
  return (
    <div
      className={`p-3 rounded-xl bg-red-50 text-red-800 text-sm border border-red-200 ${className}`}
    >
      <p className="font-medium">{message}</p>
      {showCta && (
        <Link
          href="/me/premium"
          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors text-sm"
        >
          Ver planes →
        </Link>
      )}
    </div>
  );
}
