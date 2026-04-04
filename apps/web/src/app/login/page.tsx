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
  const [oauthError, setOauthError] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(false);
  const [demoErrorMessage, setDemoErrorMessage] = useState<string | null>(null);
  const [adminMagicNotice, setAdminMagicNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const useDemoTriggered = useRef(false);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth') setOauthError(true);
  }, [searchParams]);

  const handleDemoLink = useCallback(async () => {
    setDemoError(false);
    setDemoErrorMessage(null);
    setDemoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/demo`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        code?: string;
      };
      if (res.ok && data.ok !== false) {
        window.location.href = '/feed';
        return;
      }
      setDemoError(true);
      setDemoErrorMessage(
        data.message ??
          (res.status === 503
            ? 'El servidor no pudo crear la sesión demo. Reintentá en unos segundos.'
            : null)
      );
    } catch {
      setDemoError(true);
      setDemoErrorMessage('Error de conexión con el servidor.');
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
    setAdminMagicNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/magic/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        devLink?: string;
        code?: string;
      } | null;
      if (res.ok) {
        if (data?.code === 'ADMIN_USE_PASSWORD') {
          setStatus('idle');
          setAdminMagicNotice(
            data.message ??
              'Este email es de administrador: usá email y contraseña en el formulario de abajo.'
          );
          return;
        }
        setStatus('sent');
        setMagicMessage(data?.message ?? null);
        if (data?.devLink) setDevLink(data.devLink);
      } else {
        setStatus('error');
        setMagicMessage(data?.message ?? null);
      }
    } catch {
      setStatus('error');
    }
  }

  function handleVolver() {
    setStatus('idle');
    setDevLink(null);
    setMagicMessage(null);
    setAdminMagicNotice(null);
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

  function handleOAuth(provider: string) {
    window.location.href = `${API_BASE}/auth/oauth/${provider}`;
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
      <div className="w-full max-w-sm space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-[var(--mp-foreground)]">
          Iniciar sesión
        </h1>

        <form onSubmit={handleMagicLink} className="space-y-5">
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
          <div className="text-sm text-center space-y-2">
            <p className="text-green-600">
              {magicMessage ??
                'Revisá tu correo. Si existe, recibirás un link para iniciar sesión.'}
            </p>
            {devLink && (
              <a
                href={devLink}
                className="block w-full py-3 mt-2 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200"
                target="_blank"
                rel="noreferrer"
              >
                Abrir link de acceso (dev)
              </a>
            )}
            <button
              type="button"
              onClick={handleVolver}
              className="block w-full py-2 mt-2 text-sm text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] border border-[var(--mp-border)] rounded-xl hover:bg-[var(--mp-card)]"
            >
              Volver
            </button>
          </div>
        )}
        {adminMagicNotice && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center space-y-1">
            <p>{adminMagicNotice}</p>
            <p className="text-xs text-amber-800/90">
              Cuentas Kiteprop: misma contraseña de equipo que en el panel (campo
              &quot;Contraseña&quot; abajo).
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-sm text-red-600 text-center space-y-1">
            <p>{magicMessage ?? 'Error. Intentá de nuevo.'}</p>
            <p className="text-[var(--mp-muted)] text-xs">
              Para ingresar rápido, usá <strong>Entrar como demo</strong>.
            </p>
          </div>
        )}

        {searchParams.get('error') === 'admin_magic_forbidden' && (
          <div className="text-sm text-red-600 text-center space-y-1">
            <p>Los administradores deben ingresar con email y contraseña.</p>
          </div>
        )}

        <form
          onSubmit={handlePasswordLogin}
          className="space-y-2 pt-4 border-t border-[var(--mp-border)]"
        >
          <p className="text-xs text-[var(--mp-muted)]">
            Cuentas admin Kiteprop: mismo email arriba + contraseña de equipo abajo. Magic link no
            aplica para admin.
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

        <div className="space-y-1">
          <button
            type="button"
            onClick={handleDemoLink}
            disabled={demoLoading}
            className="w-full py-2 text-sm font-medium rounded-lg border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
          >
            {demoLoading ? 'Entrando...' : 'Entrar como demo'}
          </button>
          {demoError && (
            <p className="text-xs text-red-600 text-center">
              {demoErrorMessage ??
                'No se pudo conectar con la API. En local: dejá la terminal con pnpm run dev-local.'}
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

        <p className="text-center text-xs text-[var(--mp-muted)] pt-4 border-t border-[var(--mp-border)]">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-sky-600 hover:underline">
            Registrarse
          </Link>
        </p>
        <p className="text-center text-xs text-[var(--mp-muted)]">
          Si te redirige al feed al entrar, hay sesión activa.{' '}
          <button type="button" onClick={handleLogout} className="underline hover:no-underline">
            Cerrar sesión y limpiar
          </button>
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
