'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = '/api';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [info, setInfo] = useState<{
    email: string;
    role: string;
    organizationName: string;
    expiresAt: string;
    valid: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/invitations/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  function handleAccept() {
    if (!token) return;
    setError('');
    setAccepting(true);
    fetch(`${API_BASE}/invitations/${token}/accept`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setError(data.message);
        } else {
          setDone(true);
        }
      })
      .catch(() => setError('Error al aceptar'))
      .finally(() => setAccepting(false));
  }

  if (!token) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Faltaba el enlace de invitación.</p>
          <Link href="/feed" className="text-blue-600 hover:underline">
            Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="h-24 w-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!info) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Invitación no encontrada o inválida.</p>
          <Link href="/feed" className="text-blue-600 hover:underline">
            Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">¡Listo!</h1>
          <p className="text-slate-600 mb-6">
            Ya formás parte de <strong>{info.organizationName}</strong> como{' '}
            {info.role === 'AGENT' ? 'agente' : 'corredor'}.
          </p>
          <Link
            href="/feed"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  const roleLabel = info.role === 'AGENT' ? 'Agente' : 'Corredor inmobiliario';

  return (
    <main className="min-h-screen p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Invitación a {info.organizationName}
        </h1>
        <p className="text-slate-600 mb-6">
          Te invitaron a unirte como <strong>{roleLabel}</strong>. La invitación es para el email{' '}
          <strong>{info.email}</strong>.
        </p>
        {!info.valid && (
          <p className="text-amber-600 text-sm mb-4">Esta invitación ya fue usada o expiró.</p>
        )}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="flex flex-col gap-2">
          {info.valid && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {accepting ? 'Aceptando...' : 'Aceptar invitación'}
            </button>
          )}
          <Link href="/feed" className="text-center text-slate-600 hover:underline text-sm">
            Ir al inicio
          </Link>
        </div>
        {info.valid && (
          <p className="text-xs text-slate-500 mt-4">
            Tenés que estar logueado con el email {info.email}. Si no tenés cuenta, creala desde el
            inicio.
          </p>
        )}
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4 flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </main>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
