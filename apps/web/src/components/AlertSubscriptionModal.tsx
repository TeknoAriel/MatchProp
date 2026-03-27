'use client';

import Link from 'next/link';

/** Compatible con `Subscription` de la página de alertas */
export type AlertSubscriptionForModal = {
  id: string;
  savedSearchId: string | null;
  savedSearchName: string | null;
  savedSearchQueryText?: string | null;
  type: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  NEW_LISTING: { label: 'Nuevas publicaciones', icon: '🏠' },
  PRICE_DROP: { label: 'Bajó el precio', icon: '📉' },
  BACK_ON_MARKET: { label: 'Volvió al mercado', icon: '🔄' },
};

interface AlertSubscriptionModalProps {
  open: boolean;
  sub: AlertSubscriptionForModal | null;
  onClose: () => void;
  togglingId: string | null;
  onToggle: (sub: AlertSubscriptionForModal) => void | Promise<void>;
  onVerResultados: (sub: AlertSubscriptionForModal) => void | Promise<void>;
  onDelete: (id: string) => void;
}

export default function AlertSubscriptionModal({
  open,
  sub,
  onClose,
  togglingId,
  onToggle,
  onVerResultados,
  onDelete,
}: AlertSubscriptionModalProps) {
  if (!open || !sub) return null;

  const typeInfo = TYPE_LABELS[sub.type] ?? { label: sub.type, icon: '🔔' };
  const busy = togglingId === sub.id;

  function handleDelete() {
    const current = sub;
    if (!current) return;
    if (!confirm('¿Eliminar esta alerta? No podrás deshacerlo.')) return;
    onDelete(current.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-[var(--mp-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto border border-[var(--mp-border)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
      >
        <div className="p-5 border-b border-[var(--mp-border)]">
          <h2 id="alert-modal-title" className="text-lg font-semibold text-[var(--mp-foreground)]">
            Gestionar alerta
          </h2>
          <p className="text-xs text-[var(--mp-muted)] mt-1">
            {typeInfo.icon} {typeInfo.label}
          </p>
          <p className="font-medium text-[var(--mp-foreground)] mt-2 truncate">
            {sub.savedSearchName ?? 'Búsqueda guardada'}
          </p>
          {(sub.savedSearchQueryText ?? '').trim() && (
            <p className="text-sm text-[var(--mp-muted)] mt-1 line-clamp-3">
              {sub.savedSearchQueryText}
            </p>
          )}
          <p className="text-xs text-[var(--mp-muted)] mt-2">
            {sub.isEnabled ? '✓ Activa' : '⏸ Pausada'}
            {sub.lastRunAt && (
              <> · Última ejecución: {new Date(sub.lastRunAt).toLocaleDateString('es-AR')}</>
            )}
          </p>
        </div>

        <div className="p-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(sub)}
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)] text-[var(--mp-foreground)] font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : sub.isEnabled ? '⏸ Pausar alerta' : '▶ Activar alerta'}
          </button>

          {sub.savedSearchId && (
            <>
              <button
                type="button"
                onClick={() => {
                  onVerResultados(sub);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600"
              >
                📋 Ver resultados en listado
              </button>
              <Link
                href={`/searches/${sub.savedSearchId}`}
                onClick={onClose}
                className="block w-full text-center px-4 py-3 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-medium hover:bg-sky-100"
              >
                ✏️ Ir a la búsqueda guardada
              </Link>
            </>
          )}

          <Link
            href="/searches"
            onClick={onClose}
            className="block w-full text-center px-4 py-3 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200"
          >
            📂 Ver todas mis búsquedas
          </Link>

          <button
            type="button"
            onClick={handleDelete}
            className="w-full px-4 py-3 rounded-xl text-red-600 bg-red-50 border border-red-100 font-medium hover:bg-red-100"
          >
            🗑️ Eliminar esta alerta
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-sm text-[var(--mp-muted)] font-medium hover:text-[var(--mp-foreground)]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
