'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notifyNotificationsChanged } from '../../../lib/notificationEvents';

const API_BASE = '/api';

type NotificationPayload = {
  leadId?: string;
  listingId?: string;
  listingTitle?: string;
  [key: string]: unknown;
};

type Notification = {
  id: string;
  type: string;
  payload: NotificationPayload | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  LEAD_SENT: 'Consulta enviada',
  ALERT_NEW_LISTING: 'Nueva publicación',
  ALERT_PRICE_DROP: 'Bajó el precio',
  ALERT_BACK_ON_MARKET: 'Volvió al mercado',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  function fetchNotifications() {
    fetch(`${API_BASE}/me/notifications`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchNotifications();
  }, [router]);

  async function markRead(id: string) {
    const res = await fetch(`${API_BASE}/me/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (res.ok) {
      setList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      notifyNotificationsChanged();
    }
  }

  async function markAllRead() {
    const res = await fetch(`${API_BASE}/me/notifications/read-all`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      setList((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      notifyNotificationsChanged();
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-3">
          <div className="h-16 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-16 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-16 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
          <div className="flex items-center gap-3">
            {list.some((n) => !n.readAt) ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 underline"
              >
                Marcar todas leídas
              </button>
            ) : null}
            <Link
              href="/feed"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              ← Match
            </Link>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-8 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <p className="text-slate-500">No tenés notificaciones todavía.</p>
              <p className="text-sm text-slate-400 mt-2">
                Cuando envies una consulta o haya nuevas propiedades para tu búsqueda, aparecerán
                acá.
              </p>
              <Link
                href="/feed"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                Ir a Match
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Así se verán tus notificaciones
              </p>
              <ul className="space-y-2">
                <li className="rounded-xl border border-slate-200 bg-white p-4 opacity-80">
                  <p className="font-medium text-slate-900">Consulta enviada</p>
                  <p className="text-sm text-slate-600 truncate">
                    Depto 2 amb Palermo · USD 120.000
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Hace 2 h</p>
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                    Ejemplo
                  </span>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4 opacity-80">
                  <p className="font-medium text-slate-900">Nueva publicación</p>
                  <p className="text-sm text-slate-600 truncate">Casa con pileta en Rosario</p>
                  <p className="text-xs text-slate-400 mt-1">Hace 1 d</p>
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                    Ejemplo
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
              <h3 className="font-semibold text-slate-800 mb-2">Propuesta: Notificaciones push</h3>
              <p className="text-sm text-slate-600 mb-4">
                En el futuro podrás recibir notificaciones push cuando:
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-4">
                <li>• Una inmobiliaria responda tu consulta</li>
                <li>• Haya nuevas propiedades que coincidan con tu búsqueda</li>
                <li>• Te recuerde una visita agendada</li>
              </ul>
              <div className="flex gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 bg-slate-200 rounded">Maqueta</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Push pendiente</span>
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 transition-all ${
                  n.readAt ? 'bg-white border-slate-100' : 'bg-blue-50/50 border-blue-100'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{TYPE_LABEL[n.type] ?? n.type}</p>
                    {n.payload?.listingTitle && (
                      <p className="text-sm text-slate-600 truncate mt-0.5">
                        {n.payload.listingTitle}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {n.payload?.leadId && (
                      <Link
                        href={`/leads/${n.payload.leadId}/chat`}
                        className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded-lg"
                      >
                        Ver chat
                      </Link>
                    )}
                    {n.payload?.listingId && !n.payload?.leadId && (
                      <Link
                        href={`/listing/${n.payload.listingId}`}
                        className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded-lg"
                      >
                        Ver
                      </Link>
                    )}
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
