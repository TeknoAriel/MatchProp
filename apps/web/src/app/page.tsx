'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          router.replace('/dashboard');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--mp-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--mp-bg)]">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-4xl">🏠</span>
          </div>

          <h1 className="text-3xl font-bold text-[var(--mp-foreground)] mb-3">MatchProp</h1>
          <p className="text-lg text-[var(--mp-muted)] mb-8">
            Encontrá tu próximo hogar.
            <br />
            <span className="text-[var(--mp-accent)] font-medium">
              Decí qué buscás y te matcheamos.
            </span>
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-6 py-4 bg-[var(--mp-accent)] text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity text-center"
            >
              Empezar a buscar
            </Link>
            <Link
              href="/login?useDemo=1"
              className="block w-full px-6 py-3 border-2 border-green-600 text-green-700 dark:text-green-400 font-medium rounded-2xl hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors text-center"
            >
              Entrar como demo
            </Link>
            <p className="text-sm text-[var(--mp-muted)]">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-[var(--mp-accent)] font-medium hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-sm">
          <div>
            <div className="text-2xl mb-1">🔍</div>
            <p className="text-xs text-[var(--mp-muted)]">Decí qué buscás</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🔥</div>
            <p className="text-xs text-[var(--mp-muted)]">Te matcheamos</p>
          </div>
          <div>
            <div className="text-2xl mb-1">💬</div>
            <p className="text-xs text-[var(--mp-muted)]">Contactá directo</p>
          </div>
        </div>
      </div>
    </main>
  );
}
