'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Status = {
  configured: boolean;
  baseUrl: string | null;
};

export default function ApiUniversalSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/api-universal-status`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        if (res.status === 403) {
          router.replace('/me/profile');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto">Cargando...</div>
      </main>
    );
  }

  const baseUrl = status?.baseUrl ?? 'http://localhost:3001';

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-[var(--mp-foreground)]">API Universal</h1>
          <Link
            href="/me/settings"
            className="px-3 py-1.5 text-sm bg-[var(--mp-card)] border border-[var(--mp-border)] rounded-lg hover:bg-[var(--mp-bg)]"
          >
            ← Configuraciones
          </Link>
        </div>

        <p className="text-sm text-[var(--mp-muted)] mb-6">
          Endpoints REST para integradores externos. Autenticación por header{' '}
          <code className="px-1.5 py-0.5 rounded bg-[var(--mp-card)]">X-API-Key</code>.
        </p>

        <div
          className={`p-4 rounded-xl border mb-6 ${
            status?.configured
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <p className="font-medium text-[var(--mp-foreground)]">
            Estado: {status?.configured ? '✅ Configurada' : '⚠️ No configurada'}
          </p>
          <p className="text-sm text-[var(--mp-muted)] mt-1">
            {status?.configured
              ? 'API_UNIVERSAL_KEY está definida en .env'
              : 'Definí API_UNIVERSAL_KEY en .env (valores separados por coma para múltiples claves)'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border bg-[var(--mp-card)] border-[var(--mp-border)]">
            <h2 className="font-semibold text-[var(--mp-foreground)] mb-2">Endpoints</h2>
            <ul className="text-sm space-y-2 text-[var(--mp-muted)]">
              <li>
                <code className="text-[var(--mp-foreground)]">GET {baseUrl}/universal/feed</code> —
                Feed paginado (limit, cursor, operation, minPrice, maxPrice)
              </li>
              <li>
                <code className="text-[var(--mp-foreground)]">GET {baseUrl}/universal/listings</code>{' '}
                — Lista con offset (limit, offset, source)
              </li>
              <li>
                <code className="text-[var(--mp-foreground)]">GET {baseUrl}/universal/health</code>{' '}
                — Healthcheck
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border bg-[var(--mp-bg)] border-[var(--mp-border)]">
            <h2 className="font-semibold text-[var(--mp-foreground)] mb-2">Ejemplo</h2>
            <pre className="text-xs overflow-x-auto p-3 rounded-lg bg-[var(--mp-card)]">
              {`curl -H "X-API-Key: TU_API_KEY" "${baseUrl}/universal/feed?limit=10"`}
            </pre>
          </div>
        </div>

        <p className="mt-6 text-xs text-[var(--mp-muted)]">
          Ver docs/IMPORTADORES_Y_API_UNIVERSAL.md para más detalles.
        </p>
      </div>
    </main>
  );
}
