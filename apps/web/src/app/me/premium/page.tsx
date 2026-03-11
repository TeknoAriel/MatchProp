'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import HacersePremiumButton from '../../../components/HacersePremiumButton';

const API_BASE = '/api';
const PREMIUM_SIM_KEY = 'matchprop_premium_sim';

function getSimPremium(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PREMIUM_SIM_KEY) === '1';
}

function PremiumContent() {
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [simPremium, setSimPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPremium =
    (premiumUntil && new Date(premiumUntil) > new Date()) ||
    simPremium ||
    searchParams?.get('premium') === 'sim';

  useEffect(() => {
    setSimPremium(getSimPremium());
    fetch(`${API_BASE}/me`, { credentials: 'include' })
      .then((res) => (res.status === 401 ? null : res.json()))
      .then((data) => {
        if (data?.premiumUntil) setPremiumUntil(data.premiumUntil);
        setLoading(false);
        if (data === null || (data && !data.id)) router.replace('/login');
      })
      .catch(() => setLoading(false));
  }, [router]);

  function toggleSimPremium() {
    const next = !getSimPremium();
    localStorage.setItem(PREMIUM_SIM_KEY, next ? '1' : '0');
    document.cookie = `${PREMIUM_SIM_KEY}=${next ? '1' : ''}; path=/; max-age=${next ? 86400 * 30 : 0}`;
    setSimPremium(next);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Premium</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSimPremium}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                simPremium || searchParams?.get('premium') === 'sim'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Para testear funciones Premium"
            >
              {simPremium || searchParams?.get('premium') === 'sim'
                ? '✓ Simulando Premium'
                : 'Simular Premium'}
            </button>
            <Link
              href="/feed"
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              Volver al feed
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {isPremium ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✓</span>
                <h2 className="text-lg font-semibold text-emerald-800">Tenés Premium activo</h2>
                {(simPremium || searchParams?.get('premium') === 'sim') && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                    Simulación
                  </span>
                )}
              </div>
              <p className="text-slate-600">
                {premiumUntil && new Date(premiumUntil) > new Date()
                  ? `Tu suscripción está vigente hasta ${new Date(premiumUntil).toLocaleDateString('es-AR', { dateStyle: 'long' })}.`
                  : 'Podés usar todas las funciones Premium.'}
              </p>
              <p className="text-sm text-slate-500">
                Con Premium podés activar tus consultas de inmuebles y coordinar visitas
                directamente.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Planes Premium</h2>
              <div className="grid gap-2 text-sm mb-4">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Usuario (like y favorito)</span>
                  <span className="font-medium">1 USD/mes</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Agente (listas personalizadas)</span>
                  <span className="font-medium">3 USD/mes</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Corredor inmobiliario</span>
                  <span className="font-medium">5 USD/mes</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Inmobiliaria (20% dto para agentes)</span>
                  <span className="font-medium">10 USD/mes</span>
                </div>
              </div>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Activá tus consultas de inmuebles
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Chateá con inmobiliarias
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Agendá visitas sin restricciones
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Compartí listas y fichas con contacto
                </li>
              </ul>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="font-medium text-slate-800">Premium mensual</p>
                <p className="text-sm text-slate-600 mt-1">
                  Suscripción mensual, cancelá cuando quieras.
                </p>
                <div className="pt-3">
                  <HacersePremiumButton variant="primary" className="w-full justify-center">
                    Suscribirme
                  </HacersePremiumButton>
                </div>
              </div>
              <p className="text-xs text-slate-500">Pago seguro con Stripe.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </main>
      }
    >
      <PremiumContent />
    </Suspense>
  );
}
