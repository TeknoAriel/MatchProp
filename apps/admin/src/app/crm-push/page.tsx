/**
 * Sprint 12: UI mínima estado CRM push outbox + Resend.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Row = {
  id: string;
  listingId: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  matchesCount: number;
  createdAt: string;
};

type Status = {
  counts: { PENDING: number; SENT: number; FAILED: number };
  topFailed: {
    id: string;
    listingId: string;
    attempts: number;
    nextAttemptAt: string | null;
    lastError: string | null;
  }[];
  nextAttemptAtNearest: string | null;
};

export default function CrmPushPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/admin/debug/crm-push`, { cache: 'no-store' }),
        fetch(`${API_BASE}/admin/debug/crm-push/list`, { cache: 'no-store' }),
      ]);
      if (statusRes.ok) setStatus((await statusRes.json()) as Status);
      if (listRes.ok) setRows((await listRes.json()) as Row[]);
      else setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function resend(id: string) {
    try {
      const res = await fetch(`${API_BASE}/admin/debug/crm-push/${id}/resend`, { method: 'POST' });
      if (res.ok) await fetchData();
    } catch {
      // ignore
    }
  }

  if (loading) return <main className="p-6">Cargando...</main>;
  if (error) return <main className="p-6 text-red-600">Error: {error}</main>;

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-bold">CRM Push Outbox</h1>
      {status && (
        <div className="mt-4 rounded border p-3 text-sm">
          <p>
            PENDING: {status.counts.PENDING} | SENT: {status.counts.SENT} | FAILED:{' '}
            {status.counts.FAILED}
          </p>
          {status.nextAttemptAtNearest && <p>Próximo intento: {status.nextAttemptAtNearest}</p>}
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2 text-left">id</th>
              <th className="p-2 text-left">listingId</th>
              <th className="p-2 text-left">status</th>
              <th className="p-2 text-left">attempts</th>
              <th className="p-2 text-left">nextAttemptAt</th>
              <th className="p-2 text-left">lastError</th>
              <th className="p-2 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                <td className="p-2">
                  <Link
                    href={`/listings/${r.listingId}/matches`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.listingId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.attempts}</td>
                <td className="p-2">
                  {r.nextAttemptAt ? new Date(r.nextAttemptAt).toLocaleString() : '—'}
                </td>
                <td className="max-w-[200px] truncate p-2 text-gray-600" title={r.lastError ?? ''}>
                  {r.lastError ?? '—'}
                </td>
                <td className="p-2">
                  {(r.status === 'FAILED' || r.status === 'PENDING') && (
                    <button
                      type="button"
                      onClick={() => resend(r.id)}
                      className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                    >
                      Resend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="mt-2 text-gray-500">Sin registros.</p>}
      </div>
    </main>
  );
}
