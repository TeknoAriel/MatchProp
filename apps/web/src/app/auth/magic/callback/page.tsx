'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchMagicVerifyOnce } from '../magic-verify-once';

const API_BASE = '/api';

function MagicCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Falta el token');
      return;
    }

    fetchMagicVerifyOnce(token, API_BASE)
      .then(async (res) => {
        if (res.ok) {
          setStatus('ok');
          router.replace('/feed');
          return;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setStatus('error');
        setError(
          typeof data?.message === 'string' && data.message.length > 0
            ? data.message
            : 'Link inválido o expirado'
        );
      })
      .catch((err: unknown) => {
        setStatus('error');
        const name =
          err && typeof err === 'object' && 'name' in err ? String((err as Error).name) : '';
        setError(
          name === 'AbortError'
            ? 'Tiempo de espera agotado (el servidor tardó demasiado). Reintentá o entrá con email y contraseña.'
            : 'Error de conexión'
        );
      });
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center">
        <p className="text-gray-600">Iniciando sesión…</p>
        <p className="text-sm text-gray-500 mt-3">
          Si la API estuvo inactiva, el primer intento puede tardar hasta dos minutos.
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-red-600 mb-4">{error}</p>
        <a href="/login" className="text-blue-600 hover:underline">
          Volver al login
        </a>
      </main>
    );
  }

  return null;
}

export default function MagicCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
          <p className="text-gray-600">Iniciando sesión…</p>
        </main>
      }
    >
      <MagicCallbackContent />
    </Suspense>
  );
}
