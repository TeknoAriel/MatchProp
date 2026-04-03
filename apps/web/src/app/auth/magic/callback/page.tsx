'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

    fetch(`${API_BASE}/auth/magic/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
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
      .catch(() => {
        setStatus('error');
        setError('Error de conexión');
      });
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-600">Iniciando sesión...</p>
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
          <p className="text-gray-600">Iniciando sesión...</p>
        </main>
      }
    >
      <MagicCallbackContent />
    </Suspense>
  );
}
