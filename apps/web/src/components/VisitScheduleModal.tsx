'use client';

import { useState } from 'react';
import { toDatetimeLocalValue } from '../lib/datetime-local';

const API_BASE = '/api';

export interface VisitScheduleModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  onScheduled?: () => void;
}

export default function VisitScheduleModal({
  open,
  onClose,
  leadId,
  onScheduled,
}: VisitScheduleModalProps) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt || sending) return;
    const dt = new Date(scheduledAt);
    if (dt <= new Date()) {
      setError('La fecha y hora deben ser futuras');
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
        onClose();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Error al agendar');
        return;
      }
      setScheduledAt('');
      setNote('');
      onScheduled?.();
      onClose();
    } catch {
      setError('Error de red');
    } finally {
      setSending(false);
    }
  }

  const minDatetime = new Date();
  minDatetime.setMinutes(minDatetime.getMinutes() + 30);
  const minStr = toDatetimeLocalValue(minDatetime);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-slate-900 mb-1">Agendar visita</h3>
        <p className="text-sm text-slate-600 mb-4">
          Elegí fecha y hora para coordinar la visita con el anunciante.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minStr}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Preferencia por la mañana"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={sending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Agendando...' : 'Confirmar visita'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 rounded-xl hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-500 mt-3">
          Podés ver y editar tus visitas en{' '}
          <a href="/me/visits" className="text-blue-600 hover:underline">
            Mis visitas
          </a>
          .
        </p>
      </div>
    </div>
  );
}
