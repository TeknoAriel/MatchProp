/**
 * Admin: listado general de usuarios + acceso a ficha
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UserRow = {
  id: string;
  email: string;
  role: string;
  premiumUntil: string | null;
};

type Summary = {
  totalUsers: number;
  premiumUsers: number;
  roleCounts: Record<string, number>;
};

type Response = {
  summary: Summary | null;
  users: UserRow[];
};

function daysRemainingFromIso(iso: string | null): number {
  if (!iso) return 0;
  const until = new Date(iso);
  const now = new Date();
  const ms = until.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  const params = useMemo(() => {
    const usp = new URLSearchParams();
    if (query.trim()) usp.set('query', query.trim());
    usp.set('limit', String(limit));
    usp.set('offset', String(offset));
    usp.set('includeSummary', query.trim() ? 'false' : 'true');
    return usp.toString();
  }, [query, offset]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/admin/users?${params}`, { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Response | null) => {
        if (!mounted) return;
        if (!data) {
          setUsers([]);
          setSummary(null);
          setError('Error consultando usuarios.');
          return;
        }
        setUsers(Array.isArray(data.users) ? data.users : []);
        setSummary(data.summary ?? null);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-bold">Usuarios</h1>

      <div className="mt-4 flex gap-2 items-center flex-wrap">
        <input
          className="border rounded px-3 py-2 text-sm"
          value={query}
          onChange={(e) => {
            setOffset(0);
            setQuery(e.target.value);
          }}
          placeholder="Buscar por email…"
        />
        <button
          type="button"
          onClick={() => setOffset(0)}
          className="rounded bg-slate-900 px-3 py-2 text-white text-sm hover:bg-slate-700"
        >
          Buscar
        </button>
      </div>

      {summary && (
        <div className="mt-4 rounded border p-3 text-sm">
          <div className="flex gap-4 flex-wrap">
            <div>
              <div className="text-gray-600">Total usuarios</div>
              <div className="font-semibold">{summary.totalUsers}</div>
            </div>
            <div>
              <div className="text-gray-600">Premium activos</div>
              <div className="font-semibold">{summary.premiumUsers}</div>
            </div>
          </div>
          <div className="mt-2 text-gray-700">
            Roles:{' '}
            {Object.entries(summary.roleCounts)
              .map(([k, v]) => `${k}:${v}`)
              .join(' | ')}
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-4">Cargando…</p>
      ) : error ? (
        <p className="mt-4 text-red-600">{error}</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left border">Email</th>
                  <th className="p-2 text-left border">Rol</th>
                  <th className="p-2 text-left border">Premium hasta</th>
                  <th className="p-2 text-left border">Días restantes</th>
                  <th className="p-2 text-left border">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="p-2 border">
                      <span className="font-mono text-xs">{u.email}</span>
                    </td>
                    <td className="p-2 border">{u.role}</td>
                    <td className="p-2 border">
                      {u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-2 border">{daysRemainingFromIso(u.premiumUntil)}</td>
                    <td className="p-2 border">
                      <Link href={`/users/${u.id}`} className="text-blue-600 hover:underline">
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-gray-600">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={offset <= 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="rounded bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + limit)}
              className="rounded bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
