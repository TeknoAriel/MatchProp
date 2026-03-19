'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = '/api';

type CheckStatus = 'pending' | 'ok' | 'fail';

export default function StatusPage() {
  const [webOk, setWebOk] = useState<CheckStatus>('ok');
  const [apiOk, setApiOk] = useState<CheckStatus>('pending');
  const [authOk, setAuthOk] = useState<CheckStatus>('pending');
  const [listingsCount, setListingsCount] = useState<{
    total?: number;
    bySource?: Record<string, number>;
  } | null>(null);
  const [listingsCountError, setListingsCountError] = useState<string | null>(null);
  const [connectPath, setConnectPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>(API_BASE);
  useEffect(() => {
    setBaseUrl(typeof window !== 'undefined' ? `${window.location.origin}${API_BASE}` : API_BASE);
  }, []);

  const runChecks = useCallback(async () => {
    setWebOk('ok');
    setApiOk('pending');
    setAuthOk('pending');
    setListingsCountError(null);
    setConnectPath(null);
    setLoading(true);

    try {
      const healthRes = await fetch(`${API_BASE}/health`, { credentials: 'include' });
      setApiOk(healthRes.ok ? 'ok' : 'fail');
    } catch {
      setApiOk('fail');
    }

    try {
      const connectRes = await fetch(`${API_BASE}/status/connect`, { credentials: 'include' });
      if (connectRes.ok) {
        const data = await connectRes.json().catch(() => ({}));
        setConnectPath((data as { path?: string })?.path ?? 'ok');
      } else {
        const pathHeader = connectRes.headers.get('X-MatchProp-Path');
        setConnectPath(pathHeader ? `404 path=${pathHeader}` : `status=${connectRes.status}`);
      }
    } catch {
      setConnectPath('error');
    }

    try {
      const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      setAuthOk(meRes.status === 200 || meRes.status === 401 ? 'ok' : 'fail');
    } catch {
      setAuthOk('fail');
    }

    try {
      const listRes = await fetch(`${API_BASE}/status/listings-count`, {
        credentials: 'include',
      });
      if (listRes.ok) {
        const data = await listRes.json();
        setListingsCount({ total: data.total, bySource: data.bySource });
        setListingsCountError(null);
      } else {
        setListingsCount(null);
        const body = await listRes.text();
        setListingsCountError(`${listRes.status} ${body.slice(0, 80)}`);
      }
    } catch (e) {
      setListingsCount(null);
      setListingsCountError(e instanceof Error ? e.message : 'Error de red');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-2">Estado del sistema</h1>
      <p className="text-sm text-gray-600 mb-4">
        Base URL usada por el front: <code className="bg-gray-100 px-1 rounded">{baseUrl}</code>
      </p>

      <ul className="space-y-3 mb-6">
        <li className="flex items-center justify-between p-3 rounded-xl bg-white shadow-sm border border-gray-100">
          <span>WEB OK (render)</span>
          <span className={webOk === 'ok' ? 'text-green-600' : 'text-gray-400'}>
            {webOk === 'ok' ? 'OK' : '—'}
          </span>
        </li>
        <li className="flex items-center justify-between p-3 rounded-xl bg-white shadow-sm border border-gray-100">
          <span>API OK (GET /api/health)</span>
          <span
            className={
              apiOk === 'ok'
                ? 'text-green-600'
                : apiOk === 'fail'
                  ? 'text-red-600'
                  : 'text-gray-400'
            }
          >
            {apiOk === 'pending' ? '...' : apiOk === 'ok' ? 'OK' : 'DOWN'}
          </span>
        </li>
        <li className="flex items-center justify-between p-3 rounded-xl bg-white shadow-sm border border-gray-100">
          <span>CONNECT (GET /api/status/connect)</span>
          <span className="text-xs font-mono text-gray-600" title={connectPath ?? ''}>
            {connectPath ?? '...'}
          </span>
        </li>
        <li className="flex items-center justify-between p-3 rounded-xl bg-white shadow-sm border border-gray-100">
          <span>AUTH OK (GET /api/auth/me)</span>
          <span
            className={
              authOk === 'ok'
                ? 'text-green-600'
                : authOk === 'fail'
                  ? 'text-red-600'
                  : 'text-gray-400'
            }
          >
            {authOk === 'pending' ? '...' : authOk === 'ok' ? 'OK' : 'DOWN'}
          </span>
        </li>
        <li className="flex items-center justify-between p-3 rounded-xl bg-white shadow-sm border border-gray-100">
          <span>LISTINGS COUNT (GET /api/status/listings-count)</span>
          <span className="text-gray-700 font-mono">
            {listingsCount?.total != null ? (
              <>
                {listingsCount.total}
                {listingsCount.bySource && Object.keys(listingsCount.bySource).length > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    (
                    {Object.entries(listingsCount.bySource)
                      .map(([s, n]) => `${s}: ${n}`)
                      .join(', ')}
                    )
                  </span>
                )}
              </>
            ) : listingsCountError ? (
              <span className="text-xs text-amber-600" title={listingsCountError}>
                {listingsCountError}
              </span>
            ) : listingsCount === null ? (
              '...'
            ) : (
              '...'
            )}
          </span>
        </li>
      </ul>

      <button
        type="button"
        onClick={runChecks}
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Comprobando...' : 'Reintentar'}
      </button>

      <p className="text-xs text-gray-500 mt-4">
        AUTH OK = 200 (logueado) o 401 (no logueado). Si ves DOWN puede ser error de red o API
        apagada.
      </p>

      <p className="text-xs text-gray-400 mt-4 font-mono" title="Commit desplegado (Vercel)">
        Versión: {process.env.NEXT_PUBLIC_APP_VERSION ?? '—'}
      </p>

      <div className="mt-6 flex gap-4">
        <Link href="/login" className="text-blue-600 hover:underline text-sm">
          Login
        </Link>
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
