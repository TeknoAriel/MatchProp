'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VisitsMonthCalendar from '../../../components/VisitsMonthCalendar';

const API_BASE = '/api';

type Visit = {
  id: string;
  scheduledAt: string;
  status: string;
  leadId: string;
  listingId: string;
  listingTitle: string | null;
};

export default function MyVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/me/visits`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        setVisits(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-3">
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Visitas agendadas</h1>
          <Link
            href="/leads"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Consultas y visitas
          </Link>
        </div>

        {visits.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-12 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <p className="text-slate-700 font-medium">No tenés visitas agendadas.</p>
              <div className="mt-4 p-4 rounded-xl bg-slate-50 text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Cómo coordinar una visita:
                </p>
                <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
                  <li className="text-slate-800">
                    Enviá una consulta desde el feed o lista (botón &quot;Quiero que me
                    contacten&quot;)
                  </li>
                  <li>
                    Andá a <strong>Consultas</strong> y activá la consulta cuando la inmobiliaria
                    responda
                  </li>
                  <li>
                    En cada consulta activa, hacé clic en <strong>Agendar visita</strong>
                  </li>
                  <li>Elegí fecha y hora. La visita aparecerá acá</li>
                </ol>
              </div>
              <Link
                href="/leads"
                className="inline-block mt-6 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                Ir a Consultas →
              </Link>
              <Link
                href="/feed"
                className="inline-block mt-3 ml-3 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
              >
                Ir a Match
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Así se verán tus visitas
              </p>
              <div className="rounded-xl border border-slate-200 bg-white p-4 opacity-80">
                <p className="font-semibold text-slate-900">Vie 15 Mar · 10:00</p>
                <p className="text-sm text-slate-600 mt-1">Depto 2 amb Palermo</p>
                <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                  Ejemplo · SCHEDULED
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <VisitsMonthCalendar visits={visits} />
            <ul className="space-y-3">
            {visits.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <Link href={`/leads/${v.leadId}/visits`} className="block">
                  <p className="font-semibold text-slate-900">
                    {new Date(v.scheduledAt).toLocaleString('es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{v.listingTitle ?? 'Propiedad'}</p>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {v.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </main>
  );
}
