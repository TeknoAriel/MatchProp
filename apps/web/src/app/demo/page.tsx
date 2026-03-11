'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

type DemoResult = {
  searchId: string;
  leadId: string;
  listingId: string;
  urls: {
    searches: string;
    leadChat: string;
    leadDetail: string;
    feedList: string;
  };
};

export default function DemoPage() {
  const router = useRouter();
  const [demoEnabled, setDemoEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/demo/status`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setDemoEnabled(data.enabled === true))
      .catch(() => setDemoEnabled(false));
  }, []);

  async function handleCreateDemo() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/demo/setup`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || 'Error al crear escenario demo');
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  if (demoEnabled === null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!demoEnabled) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-4">{PRODUCT_NAME} - Demo</h1>
        <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Demo deshabilitada (DEMO_MODE=0 en este entorno).
        </p>
        <Link href="/dashboard" className="mt-6 text-blue-600 hover:underline">
          Ir al dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-2">{PRODUCT_NAME} - Escenario demo</h1>
        <p className="text-gray-600 text-sm mb-6">
          Creá en un clic una búsqueda guardada, un lead activo con chat y visita, para probar la
          app sin comandos.
        </p>

        <button
          onClick={handleCreateDemo}
          disabled={loading}
          className="w-full py-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creando...' : 'Crear escenario demo'}
        </button>

        {error && (
          <p className="mt-4 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <h2 className="font-semibold text-gray-800">Listo. Revisá:</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={`/searches/${result.searchId}`}
                  className="text-blue-600 hover:underline block"
                >
                  Búsqueda guardada (Rosario 2 dorm)
                </Link>
              </li>
              <li>
                <Link href="/leads" className="text-blue-600 hover:underline block">
                  Mis consultas (lead ACTIVE)
                </Link>
              </li>
              <li>
                <Link
                  href={`/leads/${result.leadId}/chat`}
                  className="text-blue-600 hover:underline block"
                >
                  Chat del lead (mensaje bloqueado + uno OK)
                </Link>
              </li>
              <li>
                <Link
                  href={`/leads/${result.leadId}/visits`}
                  className="text-blue-600 hover:underline block"
                >
                  Agenda (visita mañana)
                </Link>
              </li>
              <li>
                <Link href="/feed/list" className="text-blue-600 hover:underline block">
                  Feed lista
                </Link>
              </li>
            </ul>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm">
              <p className="font-medium text-gray-700 mb-2">Checklist qué mirar:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Lead en estado ACTIVE</li>
                <li>En chat: un mensaje normal y uno con [BLOCKED] (email/url)</li>
                <li>En agenda: una visita programada</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
