'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';
const GRACE_PERIOD = process.env.NEXT_PUBLIC_PREMIUM_GRACE_PERIOD === '1';

type Visit = {
  id: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
};

type Lead = {
  id: string;
  status: string;
};

export default function LeadVisitsPage() {
  const params = useParams();
  const leadId = params.id as string;
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/leads/${leadId}/visits`, { credentials: 'include' }),
      fetch(`${API_BASE}/me/leads`, { credentials: 'include' }),
    ]).then(async ([visitsRes, leadsRes]) => {
      if (visitsRes.status === 401 || leadsRes.status === 401) {
        router.replace('/login');
        return;
      }
      if (visitsRes.ok) setVisits(await visitsRes.json());
      if (leadsRes.ok) {
        const leads = await leadsRes.json();
        const l = leads.find((x: Lead) => x.id === leadId);
        setLead(l ?? null);
      }
      setLoading(false);
    });
  }, [leadId, router]);

  async function handleAgendar() {
    if (!scheduledAt || sending) return;
    const dt = new Date(scheduledAt);
    if (dt <= new Date()) {
      setError('La fecha debe ser futura');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/visits`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: dt.toISOString() }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Error al agendar');
        return;
      }
      setScheduledAt('');
      const visitsRes = await fetch(`${API_BASE}/leads/${leadId}/visits`, {
        credentials: 'include',
      });
      if (visitsRes.ok) setVisits(await visitsRes.json());
    } catch {
      setError('Error de red');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--mp-bg)]">
        <div className="h-12 w-12 border-4 border-[var(--mp-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--mp-muted)] mt-3">Cargando agenda...</p>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-lg mx-auto">
          <p className="text-red-600">Lead no encontrado</p>
          <Link href="/leads" className="text-blue-600 underline mt-2 inline-block">
            Volver a consultas
          </Link>
        </div>
      </main>
    );
  }

  if (lead.status !== 'ACTIVE') {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-lg mx-auto">
          <p className="text-amber-800">Activá el lead para agendar visitas</p>
          <Link href="/leads" className="text-blue-600 underline mt-2 inline-block">
            Volver a consultas
          </Link>
        </div>
      </main>
    );
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  minDate.setHours(0, 0, 0, 0);
  const minStr = minDate.toISOString().slice(0, 16);

  function getPresetSlots() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sat = new Date(tomorrow);
    while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7) || 7);
    return [
      {
        label: 'Mañana 10:00',
        dt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0),
      },
      {
        label: 'Mañana 15:00',
        dt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 15, 0),
      },
      {
        label: 'Mañana 17:00',
        dt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 17, 0),
      },
      {
        label: 'Sábado 11:00',
        dt: new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 11, 0),
      },
      {
        label: 'Sábado 16:00',
        dt: new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 16, 0),
      },
      {
        label: 'Lun próximo 10:00',
        dt: new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate(), 10, 0),
      },
    ];
  }

  const presets = getPresetSlots();

  async function quickAgendar(dt: Date) {
    if (dt <= new Date() || sending) return;
    setScheduledAt(dt.toISOString().slice(0, 16));
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/visits`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: dt.toISOString() }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al agendar');
        return;
      }
      const visitsRes = await fetch(`${API_BASE}/leads/${leadId}/visits`, {
        credentials: 'include',
      });
      if (visitsRes.ok) setVisits(await visitsRes.json());
    } catch {
      setError('Error de red');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen p-4 bg-[var(--mp-bg)]">
      <div className="max-w-lg mx-auto">
        <nav className="text-sm text-[var(--mp-muted)] mb-2">
          <Link href="/leads" className="hover:text-[var(--mp-foreground)]">
            Consultas
          </Link>
          <span className="mx-1">›</span>
          <span className="text-[var(--mp-foreground)] font-medium">Agenda</span>
        </nav>
        {GRACE_PERIOD && (
          <p className="text-xs text-slate-700 bg-[var(--mp-premium)]/15 border border-[var(--mp-premium)]/40 rounded-xl px-3 py-2 mb-4">
            Modo prueba: agenda premium habilitada.{' '}
            <Link href="/me/premium" className="underline font-medium">
              Ver planes
            </Link>
          </p>
        )}
        <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">Agenda de visitas</h1>
          <div className="flex gap-2">
            <Link
              href={`/leads/${leadId}/chat`}
              className="px-3 py-1.5 text-sm font-medium rounded-xl border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-card)]"
            >
              Chat
            </Link>
            <Link
              href="/leads"
              className="px-3 py-1.5 text-sm font-medium rounded-xl bg-[var(--mp-card)] border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
            >
              ← Consultas
            </Link>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-sm">
          <h2 className="font-semibold text-[var(--mp-foreground)] mb-3">Horarios sugeridos</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => quickAgendar(p.dt)}
                disabled={sending || p.dt <= new Date()}
                className="px-3 py-1.5 text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] rounded-xl border border-[var(--mp-border)] hover:bg-[var(--mp-card)] disabled:opacity-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <h2 className="font-semibold text-[var(--mp-foreground)] mb-3">O elegí fecha y hora</h2>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minStr}
              className="flex-1 min-w-[200px] px-3 py-2 border border-[var(--mp-border)] rounded-xl bg-[var(--mp-card)] text-[var(--mp-foreground)] focus:ring-2 focus:ring-[var(--mp-accent)] focus:border-[var(--mp-accent)] outline-none"
            />
            <button
              onClick={handleAgendar}
              disabled={sending || !scheduledAt}
              className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {sending ? '...' : 'Agendar'}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>

        <h2 className="font-semibold text-[var(--mp-foreground)] mb-3">Visitas agendadas</h2>
        {visits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--mp-border)] bg-[var(--mp-bg)]/50 py-8 px-4 text-center">
            <span className="text-3xl block mb-2">📅</span>
            <p className="text-[var(--mp-muted)] font-medium">Sin visitas agendadas</p>
            <p className="text-sm text-[var(--mp-muted)] mt-1">
              Elegí un horario sugerido arriba o ingresá fecha y hora para coordinar con la
              inmobiliaria.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] p-4 shadow-sm"
              >
                <p className="font-medium text-[var(--mp-foreground)]">
                  {new Date(v.scheduledAt).toLocaleString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-sm text-[var(--mp-muted)] mt-0.5">{v.status}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/me/visits"
          className="inline-block mt-4 text-sm font-medium text-[var(--mp-accent)] hover:underline"
        >
          Ver todas mis visitas →
        </Link>
      </div>
    </main>
  );
}
