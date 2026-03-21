/**
 * Admin: dashboard de evaluación / asignación / estadísticas
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Overview = {
  rangeStart: string;
  rangeEnd: string;
  usersTotal: number;
  usersPremiumActive: number;
  usersByRole: Record<string, number>;
  manualPlanGrantsByPlan: Record<string, number>;
  leadsCreated: number;
  leadsByStatus: Record<string, number>;
  leadsByActivationReason: Record<string, number>;
  visitsUpcoming: number;
  visitsScheduledInRange: number;
  alertsActive: number;
  matchesInRange: number;
  analyticsByEvent: Record<string, number>;
};

type LeadRow = {
  id: string;
  createdAt: string;
  status: string;
  activationReason: string | null;
  userEmail: string | null;
  userRole: string | null;
  listingId: string;
  listingTitle: string | null;
};

type VisitRow = {
  id: string;
  scheduledAt: string;
  status: string;
  leadId: string;
  userEmail: string | null;
  listingId: string;
  listingTitle: string | null;
};

type MatchRow = {
  id: string;
  listingId: string;
  matchesCount: number;
  source: string;
  createdAt: string;
};

export default function StatsPage() {
  const [days, setDays] = useState<number>(30);
  const [leadStatus, setLeadStatus] = useState<string>(''); // '' => todos
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(true);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    params.set('days', String(days));
    if (leadStatus) params.set('status', leadStatus);
    return params.toString();
  }, [days, leadStatus]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_BASE}/admin/stats/overview?days=${days}`, {
        cache: 'no-store',
        credentials: 'include',
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/admin/stats/leads?${qs}&limit=50`, {
        cache: 'no-store',
        credentials: 'include',
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `${API_BASE}/admin/stats/visits?days=${days}&limit=50&upcoming=${upcomingOnly ? 'true' : 'false'}`,
        { cache: 'no-store', credentials: 'include' }
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/admin/stats/matches?limit=20`, {
        cache: 'no-store',
        credentials: 'include',
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([ov, leadsRes, visitsRes, matchesRes]) => {
        if (!mounted) return;
        if (!ov) throw new Error('No se pudo cargar el resumen.');
        setOverview(ov as Overview);
        setLeads((leadsRes?.leads as LeadRow[]) ?? []);
        setVisits((visitsRes?.visits as VisitRow[]) ?? []);
        setMatches((matchesRes?.matches as MatchRow[]) ?? []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [days, qs, upcomingOnly]);

  const rangeText = useMemo(() => {
    if (!overview) return '';
    const s = new Date(overview.rangeStart).toLocaleDateString();
    const e = new Date(overview.rangeEnd).toLocaleDateString();
    return `${s} - ${e}`;
  }, [overview]);

  if (loading && !overview) return <main className="min-h-screen p-6">Cargando…</main>;
  if (error) return <main className="min-h-screen p-6 text-red-600">{error}</main>;
  if (!overview) return <main className="min-h-screen p-6">Sin datos.</main>;

  return (
    <main className="min-h-screen p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-bold">Estadísticas globales</h1>
      <div className="mt-2 text-sm text-gray-600">Rango: {rangeText || '—'}</div>

      <div className="mt-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-xs text-gray-600 block">Días</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block">Estado de leads</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={leadStatus}
            onChange={(e) => setLeadStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
          />
          Solo próximas visitas
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Usuarios</div>
          <div className="font-semibold">{overview.usersTotal}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Premium activos</div>
          <div className="font-semibold">{overview.usersPremiumActive}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Leads creados</div>
          <div className="font-semibold">{overview.leadsCreated}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Visitas próximas</div>
          <div className="font-semibold">{overview.visitsUpcoming}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Alertas activas</div>
          <div className="font-semibold">{overview.alertsActive ?? 0}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Matches (período)</div>
          <div className="font-semibold">{overview.matchesInRange ?? 0}</div>
        </div>
        <div className="border rounded p-3 text-sm">
          <div className="text-gray-600">Analytics</div>
          <div className="text-xs mt-1 space-y-0.5">
            {overview.analyticsByEvent && Object.keys(overview.analyticsByEvent).length > 0
              ? Object.entries(overview.analyticsByEvent).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500 truncate">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))
              : <span className="text-gray-500">—</span>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Usuarios por rol</div>
          <div className="mt-2 space-y-1">
            {Object.entries(overview.usersByRole).map(([role, count]) => (
              <div key={role} className="flex justify-between">
                <span className="text-gray-700">{role}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(overview.usersByRole).length === 0 && (
              <div className="text-gray-500">—</div>
            )}
          </div>
        </div>

        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Asignación (planes manuales)</div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left border">Plan</th>
                  <th className="p-2 text-left border">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(overview.manualPlanGrantsByPlan).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-2 text-gray-500">
                      —{/* noop */}
                    </td>
                  </tr>
                ) : (
                  Object.entries(overview.manualPlanGrantsByPlan).map(([plan, count]) => (
                    <tr key={plan} className="border-b">
                      <td className="p-2 border">{plan}</td>
                      <td className="p-2 border">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Evaluación (leads)</div>
          <div className="mt-2">
            <div className="text-gray-600">Por estado</div>
            <div className="mt-1 space-y-1">
              {Object.entries(overview.leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-gray-700">{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-gray-600">Por motivo de activación</div>
            <div className="mt-1 space-y-1">
              {Object.entries(overview.leadsByActivationReason).map(([reason, count]) => (
                <div key={reason} className="flex justify-between">
                  <span className="text-gray-700">{reason}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Tabla de leads (últimos {days} días)</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left border">Fecha</th>
                  <th className="p-2 text-left border">User</th>
                  <th className="p-2 text-left border">Rol</th>
                  <th className="p-2 text-left border">Status</th>
                  <th className="p-2 text-left border">Motivo</th>
                  <th className="p-2 text-left border">Listing</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-2 text-gray-500">
                      —{/* noop */}
                    </td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2 border">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="p-2 border">{l.userEmail ?? '—'}</td>
                      <td className="p-2 border">{l.userRole ?? '—'}</td>
                      <td className="p-2 border">{l.status}</td>
                      <td className="p-2 border">{l.activationReason ?? '—'}</td>
                      <td className="p-2 border">{l.listingTitle ?? l.listingId.slice(0, 8)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Tabla de visitas (últimos {days} días)</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left border">Fecha</th>
                  <th className="p-2 text-left border">User</th>
                  <th className="p-2 text-left border">Status</th>
                  <th className="p-2 text-left border">Lead</th>
                  <th className="p-2 text-left border">Listing</th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-2 text-gray-500">
                      —{/* noop */}
                    </td>
                  </tr>
                ) : (
                  visits.map((v) => (
                    <tr key={v.id} className="border-b">
                      <td className="p-2 border">{new Date(v.scheduledAt).toLocaleDateString()}</td>
                      <td className="p-2 border">{v.userEmail ?? '—'}</td>
                      <td className="p-2 border">{v.status}</td>
                      <td className="p-2 border font-mono">{v.leadId.slice(0, 10)}…</td>
                      <td className="p-2 border">{v.listingTitle ?? v.listingId.slice(0, 8)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded p-4 text-sm">
          <div className="font-semibold">Matches recientes</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left border">Fecha</th>
                  <th className="p-2 text-left border">Listing</th>
                  <th className="p-2 text-left border">Matches</th>
                  <th className="p-2 text-left border">Source</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-2 text-gray-500">
                      —
                    </td>
                  </tr>
                ) : (
                  matches.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="p-2 border">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="p-2 border font-mono">{m.listingId.slice(0, 12)}…</td>
                      <td className="p-2 border">{m.matchesCount}</td>
                      <td className="p-2 border">{m.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
