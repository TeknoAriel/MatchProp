'use client';

import { useMemo, useState } from 'react';

type VisitLike = { scheduledAt: string; id: string };

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Calendario mensual simple: días con visita resaltados (horas en la lista debajo). */
export default function VisitsMonthCalendar({ visits }: { visits: VisitLike[] }) {
  const [cursor, setCursor] = useState(() => {
    const t = visits[0] ? new Date(visits[0].scheduledAt) : new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const { year, month, weeks, visitDays } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = (first.getDay() + 6) % 7; // Lunes = 0
    const daysInMonth = last.getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }

    const vset = new Set<string>();
    for (const v of visits) {
      const dt = new Date(v.scheduledAt);
      if (dt.getFullYear() === y && dt.getMonth() === m) {
        vset.add(String(dt.getDate()));
      }
    }

    return { year: y, month: m, weeks: rows, visitDays: vset };
  }, [cursor, visits]);

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  const title = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1)
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Visitas agendadas</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-100 text-sm"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-100 text-sm"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>
      <p className="text-center text-sm font-medium text-slate-700 capitalize mb-2">{title}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 mb-1">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((d, di) => {
              if (d === null) return <span key={`e-${ri}-${di}`} className="h-8" />;
              const has = visitDays.has(String(d));
              return (
                <div
                  key={d}
                  className={`h-8 flex items-center justify-center rounded-lg text-sm ${
                    has
                      ? 'bg-emerald-100 text-emerald-900 font-semibold ring-1 ring-emerald-300'
                      : 'text-slate-600'
                  }`}
                  title={has ? 'Tenés visita este día' : undefined}
                >
                  {d}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Los horarios exactos están en la lista de abajo.
      </p>
    </div>
  );
}
