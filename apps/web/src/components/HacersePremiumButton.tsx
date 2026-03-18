'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';
const PREMIUM_SIM_KEY = 'matchprop_premium_sim';

type Props = {
  variant?: 'primary' | 'secondary';
  className?: string;
  children?: React.ReactNode;
};

export default function HacersePremiumButton({
  variant = 'primary',
  className = '',
  children = 'Hacerse Premium',
}: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    
    try {
      // Primero intentar con el checkout real
      const res = await fetch(`${API_BASE}/me/checkout-session`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      
      const data = await res.json();
      
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      
      // Si falla (Stripe no configurado), activar simulación
      activateSimPremium();
      
    } catch {
      // En caso de error, activar simulación
      activateSimPremium();
    }
  }

  function activateSimPremium() {
    localStorage.setItem(PREMIUM_SIM_KEY, '1');
    document.cookie = `${PREMIUM_SIM_KEY}=1; path=/; max-age=${86400 * 30}`;
    
    // También actualizar en el servidor si es posible
    fetch(`${API_BASE}/me/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan: 'AGENT', provider: 'MANUAL' }),
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
      {loading ? 'Activando...' : children}
    </button>
  );
}
