'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = '/api';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [magicMessage, setMagicMessage] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(false);
  const [password, setPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const useDemoTriggered = useRef(false);

  const handleDemoLink = useCallback(async () => {
    setDemoError(false);
    setDemoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/demo`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        window.location.href = '/feed';
        return;
      }
      setDemoError(true);
    } catch {
      setDemoError(true);
    } finally {
      setDemoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams?.get('useDemo') === '1' && !useDemoTriggered.current) {
      useDemoTriggered.current = true;
      handleDemoLink();
    }
  }, [searchParams, handleDemoLink]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setDevLink(null);
    setMagicMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/magic/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatus('sent');
        setMagicMessage(data?.message ?? null);
        if (data?.devLink) setDevLink(data.devLink);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  function handleVolver() {
    setStatus('idle');
    setDevLink(null);
    setMagicMessage(null);
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(false);
    setPwdMessage('');
    setPwdLoading(true);
    try {
      // En algunos deploys, `/auth/*` puede no reescribirse correctamente en la API.
      // Usamos el alias estable `/login` para password login.
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      if (res.ok) {
        window.location.href = '/feed';
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
        debug?: { error?: string };
      };
      setPwdMessage(
        data?.message ??
          (data?.debug?.error ? `Error: ${data.debug.error}` : 'Credenciales inválidas.')
      );
      setPwdError(true);
    } catch {
      setPwdMessage('Error de conexión.');
      setPwdError(true);
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--mp-bg)]">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--mp-foreground)]">
            Iniciar sesión
          </h1>
          <p className="text-sm text-[var(--mp-muted)] mt-1">
            Magic link a tu email, o demo para probar
          </p>
        </div>

        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-[15px] font-medium mb-2 text-[var(--mp-foreground)]"
            >
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
          <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800 space-y-3">
            <p className="font-medium text-green-800 dark:text-green-300 text-center">
              ✓ Link enviado
            </p>
            <p className="text-sm text-green-700 dark:text-green-200 text-center">
              {magicMessage ??
                'Revisá tu correo. Si existe, recibirás un link para iniciar sesión.'}
            </p>
            {devLink && (
              <a
                href={devLink}
                className="block w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 text-center"
                target="_blank"
                rel="noreferrer"
              >
                Abrir magic link (dev)
              </a>
            )}
            <button
              type="button"
              onClick={handleVolver}
              className="block w-full py-2 text-sm text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] border border-[var(--mp-border)] rounded-xl hover:bg-[var(--mp-card)]"
            >
              Volver
            </button>
          </div>
        )}
        {status === 'error' && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 text-center">
            <p>
              Error al enviar. Intentá de nuevo o usá <strong>Entrar como demo</strong>.
            </p>
          </div>
        )}

        {searchParams.get('error') === 'admin_magic_forbidden' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 text-center">
            Los administradores deben entrar con email y contraseña.
          </div>
        )}

        <div className="space-y-1">
          <button
            type="button"
            onClick={handleDemoLink}
            disabled={demoLoading}
            className="w-full py-3 text-sm font-medium rounded-xl border-2 border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 disabled:opacity-50 transition-colors"
          >
            {demoLoading ? 'Entrando...' : 'Entrar como demo'}
          </button>
          {demoError && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">
              No se pudo conectar. En local ejecutá{' '}
              <code className="px-1 rounded bg-[var(--mp-card)]">pnpm run dev-local</code>.
            </p>
          )}
        </div>

        <form
          onSubmit={handlePasswordLogin}
          className="space-y-2 pt-4 border-t border-[var(--mp-border)]"
        >
          <p className="text-xs text-[var(--mp-muted)]">
            Admin: entrar con email y contraseña para configuraciones
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-2 text-sm border border-[var(--mp-border)] rounded-lg bg-[var(--mp-card)]"
          />
          <button
            type="submit"
            disabled={pwdLoading}
            className="w-full py-2 text-sm font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {pwdLoading ? 'Entrando...' : 'Entrar con email y contraseña'}
          </button>
          {pwdError && (
            <p className="text-xs text-red-600 text-center">
              {pwdMessage || 'Credenciales inválidas.'}
            </p>
          )}
        </form>

        <div className="pt-4 border-t border-[var(--mp-border)] space-y-3">
          <button
            type="button"
            onClick={() => router.push('/login/passkey')}
            className="w-full py-2.5 text-sm border border-[var(--mp-border)] rounded-xl hover:bg-[var(--mp-card)] text-[var(--mp-foreground)]"
          >
            Entrar con passkey
          </button>
          <p className="text-center text-xs text-[var(--mp-muted)]">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="text-[var(--mp-accent)] hover:underline">
              Registrarse
            </Link>
          </p>
          <p className="text-center text-xs text-[var(--mp-muted)]">
            Sesión activa?{' '}
            <button
              type="button"
              onClick={handleLogout}
              className="text-[var(--mp-accent)] hover:underline"
            >
              Cerrar sesión
            </button>
          </p>
        </div>

        <p className="text-xs text-[var(--mp-muted)] text-center">
          Google/Apple/Facebook requieren configuración. Usá Magic Link o demo.
        </p>
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
