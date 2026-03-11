'use client';

import Link from 'next/link';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--mp-bg)]">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[var(--mp-muted)]">404</h1>
        <h2 className="text-xl font-semibold text-[var(--mp-foreground)] mt-2">
          Página no encontrada
        </h2>
        <p className="text-sm text-[var(--mp-muted)] mt-2">
          La ruta que buscás no existe en {PRODUCT_NAME}.
        </p>
        <Link
          href="/feed"
          className="inline-block mt-6 px-5 py-2.5 bg-[var(--mp-accent)] text-white rounded-xl font-medium hover:opacity-90"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
