/**
 * Admin: listado de visitas agendadas
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type VisitRow = {
  id: string;
  leadId: string;
  listingId: string;
  scheduledAt: string;
  status: string;
  userEmail: string | null;
  listingTitle: string | null;
  createdAt: string;
};

export default function VisitsPage() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/debug/visits?limit=50&upcoming=${upcoming}`, {
        cache: 'no-store',
      });
      if (res.ok) setRows((await res.json()) as VisitRow[]);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [upcoming]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <main className="p-6">Cargando...</main>;

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <div className="mt-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Visitas</h1>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
          />
          Solo próximas
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-gray-500">No hay visitas.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left border">Fecha/Hora</th>
                <th className="p-2 text-left border">Estado</th>
                <th className="p-2 text-left border">Usuario</th>
                <th className="p-2 text-left border">Propiedad</th>
                <th className="p-2 text-left border">Lead</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border">
                  <td className="p-2 border">
                    {new Date(r.scheduledAt).toLocaleString('es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-2 border">{r.status}</td>
                  <td className="p-2 border">{r.userEmail ?? '—'}</td>
                  <td className="p-2 border">
                    <Link
                      href={`/listings/${r.listingId}/matches`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.listingTitle ?? r.listingId}
                    </Link>
                  </td>
                  <td className="p-2 border">
                    <span className="font-mono text-xs">{r.leadId}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
