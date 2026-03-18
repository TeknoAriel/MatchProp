'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';
const PREMIUM_SIM_KEY = 'matchprop_premium_sim';

type Props = {
  variant?: 'primary' | 'secondary';
  className?: string;
  children?: React.ReactNode;
  plan?: string;
};

export default function HacersePremiumButton({
  variant = 'primary',
  className = '',
  children = 'Hacerse Premium',
  plan = 'AGENT',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [hasPaymentProviders, setHasPaymentProviders] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/payments/config`)
      .then((r) => r.json())
      .then((data) => {
        const mpEnabled = data?.providers?.mercadopago?.enabled ?? false;
        const stripeEnabled = data?.providers?.stripe?.enabled ?? false;
        setHasPaymentProviders(mpEnabled || stripeEnabled);
      })
      .catch(() => setHasPaymentProviders(false));
  }, []);

  async function handleClick() {
    if (loading) return;
    setLoading(true);

    // Si hay proveedores de pago, ir al checkout
    if (hasPaymentProviders) {
      router.push(`/me/checkout?plan=${plan}`);
      return;
    }

    // Si no hay proveedores, activar simulación
    activateSimPremium();
  }

  function activateSimPremium() {
    localStorage.setItem(PREMIUM_SIM_KEY, '1');
    document.cookie = `${PREMIUM_SIM_KEY}=1; path=/; max-age=${86400 * 30}`;

    fetch(`${API_BASE}/me/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan, provider: 'MANUAL' }),
    }).catch(() => {});

    alert('¡Premium activado! (Modo prueba)');
    setLoading(false);
    router.refresh();
  }

  const baseClass =
    variant === 'primary'
      ? 'inline-flex items-center justify-center px-4 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50'
      : 'inline-flex items-center px-3 py-1.5 text-amber-700 bg-amber-100 rounded-lg font-medium hover:bg-amber-200 disabled:opacity-50';

  return (
    <button onClick={handleClick} disabled={loading} className={`${baseClass} ${className}`}>
      {loading ? 'Cargando...' : children}
    </button>
  );
}
