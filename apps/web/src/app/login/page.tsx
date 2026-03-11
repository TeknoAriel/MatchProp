'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = '/api';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('error') === 'oauth') setOauthError(true);
  }, [searchParams]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setDevLink(null);
    try {
      const res = await fetch(`${API_BASE}/auth/magic/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = res.ok ? await res.json() : null;
      if (res.ok) {
        setStatus('sent');
        if (data?.devLink) setDevLink(data.devLink);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  function handleOAuth(provider: string) {
    window.location.href = `${API_BASE}/auth/oauth/${provider}`;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Iniciar sesión</h1>

        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
              placeholder="tu@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'loading' ? 'Enviando...' : 'Enviar link a mi email'}
          </button>
        </form>

        {status === 'sent' && (
          <div className="text-sm text-green-600 text-center space-y-2">
            <p>Revisá tu correo. Si existe, recibirás un link para iniciar sesión.</p>
            {devLink && (
              <a
                href={devLink}
                className="block w-full py-2 mt-2 bg-green-100 text-green-800 rounded font-medium hover:bg-green-200"
                target="_blank"
                rel="noreferrer"
              >
                Abrir link de acceso (dev)
              </a>
            )}
          </div>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 text-center">Error. Intentá de nuevo.</p>
        )}

        <p className="text-sm text-amber-600 text-center">
          Google/Apple/Facebook requieren configuración. Usá Magic Link o Passkey.
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white">o continuar con</span>
          </div>
        </div>

        {oauthError && (
          <p className="text-sm text-amber-600 text-center">
            OAuth no configurado. Usá Magic Link o Passkey.
          </p>
        )}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setOauthError(false);
              handleOAuth('google');
            }}
            className="w-full py-2 border rounded hover:bg-gray-50"
          >
            Continuar con Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="w-full py-2 border rounded hover:bg-gray-50"
          >
            Continuar con Apple
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('facebook')}
            className="w-full py-2 border rounded hover:bg-gray-50"
          >
            Continuar con Facebook
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => router.push('/login/passkey')}
            className="w-full py-2 border rounded hover:bg-gray-50"
          >
            Entrar con passkey
          </button>
          <p className="text-xs text-slate-500 text-center mt-2">
            ¿Primera vez? En la pantalla de passkey podés crear uno.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-8">
          <div className="h-12 w-12 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
