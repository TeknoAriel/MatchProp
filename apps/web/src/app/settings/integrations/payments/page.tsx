'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Status = {
  stripeConfigured: boolean;
};

export default function PaymentsSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/integrations/payments-status`, { credentials: 'include' })
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

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-[var(--mp-foreground)]">Pasarela de pago</h1>
          <Link
            href="/me/settings"
            className="px-3 py-1.5 text-sm bg-[var(--mp-card)] border border-[var(--mp-border)] rounded-lg hover:bg-[var(--mp-bg)]"
          >
            ← Configuraciones
          </Link>
        </div>

        <p className="text-sm text-[var(--mp-muted)] mb-6">
          Stripe B2C para planes Premium. Las claves se configuran en variables de entorno.
        </p>

        <div
          className={`p-4 rounded-xl border mb-6 ${
            status?.stripeConfigured
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <p className="font-medium text-[var(--mp-foreground)]">
            Stripe: {status?.stripeConfigured ? '✅ Configurado' : '⚠️ No configurado'}
          </p>
          <p className="text-sm text-[var(--mp-muted)] mt-1">
            {status?.stripeConfigured
              ? 'STRIPE_SECRET_KEY está definida. Checkout y webhooks activos.'
              : 'Definí STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en .env. Ver .env.example y PROD.md.'}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-[var(--mp-card)] border-[var(--mp-border)] space-y-2">
          <h2 className="font-semibold text-[var(--mp-foreground)]">Variables de entorno</h2>
          <ul className="text-sm text-[var(--mp-muted)] space-y-1">
            <li>
              <code>STRIPE_SECRET_KEY</code> — Clave secreta (sk_test_... o sk_live_...)
            </li>
            <li>
              <code>STRIPE_WEBHOOK_SECRET</code> — Secret del webhook (whsec_...)
            </li>
            <li>
              <code>STRIPE_PRICE_BUYER</code>, <code>STRIPE_PRICE_AGENT</code>, etc.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/me/premium"
            className="px-4 py-2 rounded-xl bg-[var(--mp-premium)] text-slate-900 font-medium hover:opacity-90"
          >
            Probar checkout Premium
          </Link>
        </div>

        <p className="mt-6 text-xs text-[var(--mp-muted)]">
          Webhook: POST /webhooks/stripe. Ver docs/PRUEBA-NAVEGADOR.md para Stripe CLI local.
        </p>
      </div>
    </main>
  );
}
