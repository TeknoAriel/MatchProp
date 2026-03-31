'use client';

import { useState } from 'react';
import { enableAlertWebPush } from '../lib/push-notifications';

export default function AlertPushEnable() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onEnable() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enableAlertWebPush();
      if (r.ok) {
        setMsg('Listo: vas a recibir avisos en este dispositivo cuando haya alertas.');
      } else if (r.reason === 'denied') {
        setMsg('Activá las notificaciones en la configuración del navegador para recibir avisos.');
      } else if (r.reason === 'unsupported') {
        setMsg('Este navegador no soporta notificaciones push.');
      } else if (r.reason === 'no_vapid') {
        setMsg('El servidor aún no tiene configurada la clave VAPID para push.');
      } else {
        setMsg('No pudimos activar push. Reintentá más tarde.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 p-4 rounded-2xl border border-[var(--mp-border)] bg-[color-mix(in_srgb,var(--mp-accent)_6%,var(--mp-card))]">
      <p className="text-sm font-medium text-[var(--mp-foreground)] mb-1">
        Avisos en el teléfono y en el escritorio
      </p>
      <p className="text-xs text-[var(--mp-muted)] mb-3 leading-relaxed">
        Activá las notificaciones del sistema para enterarte al instante cuando una alerta encuentre
        una propiedad (misma cuenta en Kiteprop / MatchProp).
      </p>
      <button
        type="button"
        onClick={() => void onEnable()}
        disabled={busy}
        className="min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] disabled:opacity-50"
      >
        {busy ? 'Activando…' : 'Activar avisos push'}
      </button>
      {msg ? <p className="mt-3 text-xs text-[var(--mp-muted)] leading-relaxed">{msg}</p> : null}
    </div>
  );
}
