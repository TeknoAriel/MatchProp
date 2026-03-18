'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Plan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
};

type PaymentConfig = {
  providers: {
    mercadopago: { enabled: boolean; publicKey: string | null };
    stripe: { enabled: boolean; publicKey: string | null };
  };
  defaultProvider: string;
  currency: string;
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams?.get('plan') ?? 'AGENT';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(planId);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [provider, setProvider] = useState<'MERCADO_PAGO' | 'STRIPE'>('MERCADO_PAGO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/plans`).then((r) => r.json()),
      fetch(`${API_BASE}/payments/config`).then((r) => r.json()),
    ]).then(([plansData, configData]) => {
      setPlans(plansData.plans);
      setConfig(configData);
      if (configData.defaultProvider === 'MERCADO_PAGO') {
        setProvider('MERCADO_PAGO');
      } else {
        setProvider('STRIPE');
      }
    });
  }, []);

  const plan = plans.find((p) => p.id === selectedPlan);
  const price = plan
    ? billingCycle === 'yearly'
      ? plan.priceYearly
      : plan.priceMonthly
    : 0;

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan: selectedPlan,
          billingCycle,
          provider,
        }),
      });

      if (res.status === 401) {
        router.push('/login?redirect=/me/checkout');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al crear checkout');
        setLoading(false);
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  }

  const mpEnabled = config?.providers.mercadopago.enabled ?? false;
  const stripeEnabled = config?.providers.stripe.enabled ?? false;
  const currency = config?.currency ?? 'USD';

  return (
    <main className="py-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/me/premium"
          className="text-sm text-[var(--mp-muted)] hover:text-[var(--mp-foreground)] mb-6 inline-block"
        >
          ← Volver a planes
        </Link>

        <h1 className="text-2xl font-bold text-[var(--mp-foreground)] mb-2">
          Completar suscripción
        </h1>
        <p className="text-[var(--mp-muted)] mb-8">
          Elegí tu plan y método de pago
        </p>

        {/* Selector de plan */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-2">
            Plan
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedPlan === p.id
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                    : 'border-[var(--mp-border)] bg-[var(--mp-card)] hover:border-sky-300'
                }`}
              >
                <h3 className="font-semibold text-[var(--mp-foreground)]">{p.name}</h3>
                <p className="text-sm text-[var(--mp-muted)]">{p.description}</p>
                <p className="mt-2 text-lg font-bold text-sky-600">
                  ${billingCycle === 'yearly' ? p.priceYearly : p.priceMonthly} USD
                  <span className="text-sm font-normal text-[var(--mp-muted)]">
                    /{billingCycle === 'yearly' ? 'año' : 'mes'}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Ciclo de facturación */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-2">
            Ciclo de facturación
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 py-3 px-4 rounded-xl border font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)]'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex-1 py-3 px-4 rounded-xl border font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)]'
              }`}
            >
              Anual
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                2 meses gratis
              </span>
            </button>
          </div>
        </div>

        {/* Método de pago */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-2">
            Método de pago
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {mpEnabled && (
              <button
                onClick={() => setProvider('MERCADO_PAGO')}
                className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                  provider === 'MERCADO_PAGO'
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                    : 'border-[var(--mp-border)] bg-[var(--mp-card)] hover:border-sky-300'
                }`}
              >
                <div className="w-10 h-10 bg-[#00BCFF] rounded-lg flex items-center justify-center text-white font-bold">
                  MP
                </div>
                <div className="text-left">
                  <p className="font-medium text-[var(--mp-foreground)]">Mercado Pago</p>
                  <p className="text-xs text-[var(--mp-muted)]">
                    Tarjetas, transferencia, efectivo
                  </p>
                </div>
              </button>
            )}

            {stripeEnabled && (
              <button
                onClick={() => setProvider('STRIPE')}
                className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                  provider === 'STRIPE'
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                    : 'border-[var(--mp-border)] bg-[var(--mp-card)] hover:border-sky-300'
                }`}
              >
                <div className="w-10 h-10 bg-[#635BFF] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <div className="text-left">
                  <p className="font-medium text-[var(--mp-foreground)]">Stripe</p>
                  <p className="text-xs text-[var(--mp-muted)]">
                    Apple Pay, Google Pay, tarjetas
                  </p>
                </div>
              </button>
            )}

            {!mpEnabled && !stripeEnabled && (
              <p className="text-amber-600 text-sm col-span-2">
                No hay proveedores de pago configurados. Contactá al soporte.
              </p>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-[var(--mp-card)] rounded-2xl border border-[var(--mp-border)] p-6 mb-6">
          <h3 className="font-semibold text-[var(--mp-foreground)] mb-4">Resumen</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--mp-muted)]">Plan</span>
              <span className="font-medium">{plan?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--mp-muted)]">Ciclo</span>
              <span className="font-medium">
                {billingCycle === 'yearly' ? 'Anual' : 'Mensual'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--mp-muted)]">Método</span>
              <span className="font-medium">
                {provider === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Stripe'}
              </span>
            </div>
            <div className="border-t border-[var(--mp-border)] pt-2 mt-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-sky-600">
                  ${price} {currency}
                  {currency === 'ARS' && (
                    <span className="text-xs font-normal text-[var(--mp-muted)]">
                      {' '}(≈${price} ARS)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading || (!mpEnabled && !stripeEnabled)}
          className="w-full py-4 bg-sky-500 text-white rounded-xl font-semibold text-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Redirigiendo...' : `Pagar $${price} ${currency}`}
        </button>

        <p className="text-center text-xs text-[var(--mp-muted)] mt-4">
          Al continuar, aceptás nuestros términos de servicio y política de privacidad.
          <br />
          Podés cancelar en cualquier momento.
        </p>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
