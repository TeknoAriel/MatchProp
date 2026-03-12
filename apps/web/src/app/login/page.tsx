'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = '/api';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [demoLinkLoading, setDemoLinkLoading] = useState(false);
  const [demoLinkError, setDemoLinkError] = useState(false);
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

  async function requestDemoLink(): Promise<string | null> {
    const res = await fetch(`${API_BASE}/auth/magic/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'demo@matchprop.com' }),
    });
    const data = res.ok ? await res.json() : null;
    return data?.devLink ?? null;
  }

  async function handleDemoLink() {
    setDemoLinkError(false);
    setDemoLinkLoading(true);
    try {
      let link = await requestDemoLink();
      if (!link) {
        await new Promise((r) => setTimeout(r, 2000));
        link = await requestDemoLink();
      }
      if (link) {
        window.location.href = link;
        return;
      }
      setDemoLinkError(true);
    } catch {
      setDemoLinkError(true);
    } finally {
      setDemoLinkLoading(false);
    }
  }

  function handleOAuth(provider: string) {
    window.location.href = `${API_BASE}/auth/oauth/${provider}`;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--mp-bg)]">
      <div className="w-full max-w-sm space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-[var(--mp-foreground)]">
          Iniciar sesión
        </h1>

        <form onSubmit={handleMagicLink} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-[15px] font-medium mb-2 text-[var(--mp-foreground)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-[var(--mp-border)] rounded-xl focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none transition-colors bg-[var(--mp-card)]"
              placeholder="tu@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 text-base font-medium rounded-xl bg-[var(--mp-accent)] text-white hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {status === 'loading' ? 'Enviando...' : 'Enviar link a mi email'}
          </button>
        </form>

        {status === 'sent' && (
          <div className="text-sm text-center space-y-2">
            {devLink ? (
              <>
                <p className="text-green-600">En modo demo: usá el link de abajo para entrar.</p>
                <a
                  href={devLink}
                  className="block w-full py-3 mt-2 bg-green-100 text-green-800 rounded font-medium hover:bg-green-200"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir link de acceso (dev)
                </a>
              </>
            ) : (
              <p className="text-green-600">Revisá tu correo. Si existe, recibirás un link para iniciar sesión.</p>
            )}
          </div>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 text-center">Error. Intentá de nuevo.</p>
        )}

        <div className="space-y-1">
          <button
            type="button"
            onClick={handleDemoLink}
            disabled={demoLinkLoading}
            className="w-full py-2 text-sm font-medium rounded-lg border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
          >
            {demoLinkLoading ? 'Obteniendo link...' : 'Entrar con link demo'}
          </button>
          {demoLinkError && (
            <p className="text-xs text-red-600 text-center">
              No se pudo obtener el link (la API puede estar en cold start).{' '}
              <button type="button" onClick={handleDemoLink} className="underline hover:no-underline">
                Reintentar
              </button>
            </p>
          )}
        </div>

        <p className="text-sm text-amber-600 text-center">
          Google/Apple/Facebook requieren configuración. Usá Magic Link o Passkey.
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[var(--mp-bg)]">o continuar con</span>
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
