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
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-50">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-sky-50 via-white to-blue-50">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-4xl">🏠</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-3">MatchProp</h1>
          <p className="text-lg text-slate-600 mb-8">
            Encontrá tu próximo hogar.
            <br />
            <span className="text-sky-600 font-medium">Decí qué buscás y te matcheamos.</span>
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold rounded-2xl hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25 transition-all text-center"
            >
              Empezar a buscar
            </Link>

            <p className="text-sm text-slate-500">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-sky-600 font-medium hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-sm">
          <div>
            <div className="text-2xl mb-1">🔍</div>
            <p className="text-xs text-slate-500">Decí qué buscás</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🔥</div>
            <p className="text-xs text-slate-500">Te matcheamos</p>
          </div>
          <div>
            <div className="text-2xl mb-1">💬</div>
            <p className="text-xs text-slate-500">Contactá directo</p>
          </div>
        </div>
      </div>
    </main>
  );
}
