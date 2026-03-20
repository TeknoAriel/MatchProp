'use client';

import Link from 'next/link';

/**
 * Banner informativo: esta función requiere premium pero en beta permite acceso completo.
 * Los planes se muestran para cuando se activen las limitaciones.
 */
export default function BetaPremiumBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm ${className}`}
    >
      <p>
        <span className="font-medium">Esta función requiere plan premium.</span> En beta tenés
        acceso completo sin límites.{' '}
        <Link href="/me/premium" className="underline font-medium hover:no-underline">
          Ver planes
        </Link>
      </p>
    </div>
  );
}
