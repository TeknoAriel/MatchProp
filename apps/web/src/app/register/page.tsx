'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE = '/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          name: name.trim() || undefined,
        }),
      });
      if (res.ok) {
        window.location.href = '/feed';
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data?.message ?? 'Error al registrarse. Intentá de nuevo.');
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--mp-bg)]">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-[var(--mp-foreground)]">
          Crear cuenta
        </h1>
        <p className="text-sm text-center text-[var(--mp-muted)]">
          Registrate para probar búsquedas, match y alertas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoComplete="email"
              className="w-full px-4 py-3 text-base border border-[var(--mp-border)] rounded-xl focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none transition-colors bg-[var(--mp-card)]"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label
              htmlFor="name"
              className="block text-[15px] font-medium mb-2 text-[var(--mp-foreground)]"
            >
              Nombre (opcional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-3 text-base border border-[var(--mp-border)] rounded-xl focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none transition-colors bg-[var(--mp-card)]"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-[15px] font-medium mb-2 text-[var(--mp-foreground)]"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-3 text-base border border-[var(--mp-border)] rounded-xl focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none transition-colors bg-[var(--mp-card)]"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-base font-medium rounded-xl bg-[var(--mp-accent)] text-white hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--mp-muted)]">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-sky-600 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
