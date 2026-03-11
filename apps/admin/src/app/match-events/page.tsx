/**
 * Sprint 11: inbox simple MatchEvent (matches found).
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Row = {
  id: string;
  listingId: string;
  matchesCount: number;
  source: string;
  createdAt: string;
};

export default function MatchEventsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/admin/debug/match-events?limit=50`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Row[]) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6">Cargando...</main>;
  if (error) return <main className="p-6 text-red-600">Error: {error}</main>;

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-bold">Match Events (inbox matches found)</h1>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2 text-left">listingId</th>
              <th className="p-2 text-left">matchesCount</th>
              <th className="p-2 text-left">source</th>
              <th className="p-2 text-left">createdAt</th>
              <th className="p-2 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">
                  <Link
                    href={`/listings/${r.listingId}/matches`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.listingId.slice(0, 12)}…
                  </Link>
                </td>
                <td className="p-2">{r.matchesCount}</td>
                <td className="p-2">{r.source}</td>
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2">
                  <Link
                    href={`/listings/${r.listingId}/matches`}
                    className="text-blue-600 hover:underline"
                  >
                    Ver interesados
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="mt-2 text-gray-500">Sin eventos.</p>}
      </div>
    </main>
  );
}
