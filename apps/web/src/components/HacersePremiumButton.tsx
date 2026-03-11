'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';

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
      const res = await fetch(`${API_BASE}/me/checkout-session`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message ?? 'Error al crear sesión de pago');
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setLoading(false);
      alert(err instanceof Error ? err.message : 'Error. Reintentá.');
    }
  }

  const baseClass =
    variant === 'primary'
      ? 'inline-flex items-center justify-center px-4 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50'
      : 'inline-flex items-center px-3 py-1.5 text-amber-700 bg-amber-100 rounded-lg font-medium hover:bg-amber-200 disabled:opacity-50';

  return (
    <button onClick={handleClick} disabled={loading} className={`${baseClass} ${className}`}>
      {loading ? 'Redirigiendo...' : children}
    </button>
  );
}
