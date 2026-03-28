'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
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
  onIrAlDeck?: (sub: AlertSubscriptionForModal) => void | Promise<void>;
  onDelete: (id: string) => void;
}

function ModalActionBtn({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--mp-radius-chip)] font-medium text-left transition-colors disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function AlertSubscriptionModal({
  open,
  sub,
  onClose,
  togglingId,
  onToggle,
  onVerResultados,
  onIrAlDeck,
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
        className="mp-modal-panel rounded-t-[var(--mp-radius-card)] sm:rounded-[var(--mp-radius-card)] w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
      >
        <div className="mp-modal-header">
          <h2 id="alert-modal-title" className="text-lg font-semibold">
            Gestionar alerta
          </h2>
          <p className="text-xs mp-modal-header-muted mt-1.5 flex items-center gap-1.5">
            <span aria-hidden>{typeInfo.icon}</span>
            {typeInfo.label}
          </p>
          <p className="font-semibold mt-3 truncate">
            {sub.savedSearchName ?? 'Búsqueda guardada'}
          </p>
          {(sub.savedSearchQueryText ?? '').trim() && (
            <p className="text-sm mp-modal-header-muted mt-1.5 line-clamp-3 leading-snug">
              {sub.savedSearchQueryText}
            </p>
          )}
          <p className="text-xs mp-modal-header-muted mt-3 flex flex-wrap gap-x-2 gap-y-0.5">
            <span>{sub.isEnabled ? '● Activa' : '○ Pausada'}</span>
            {sub.lastRunAt && (
              <span suppressHydrationWarning>
                · Última: {new Date(sub.lastRunAt).toLocaleDateString('es-AR')}
              </span>
            )}
          </p>
        </div>

        <div className="p-3 flex flex-col gap-2 bg-[var(--mp-bg)]">
          <ModalActionBtn
            disabled={busy}
            onClick={() => onToggle(sub)}
            className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700"
          >
            <span className="text-xl shrink-0" aria-hidden>
              {sub.isEnabled ? '⏸' : '▶'}
            </span>
            <span>{busy ? 'Guardando…' : sub.isEnabled ? 'Pausar alerta' : 'Activar alerta'}</span>
          </ModalActionBtn>

          {sub.savedSearchId && (
            <>
              <ModalActionBtn
                onClick={() => {
                  void onVerResultados(sub);
                  onClose();
                }}
                className="bg-[var(--mp-accent)] text-white hover:bg-[var(--mp-accent-hover)] !border-[var(--mp-accent-hover)]"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  📋
                </span>
                <span>Ver resultados (listado)</span>
              </ModalActionBtn>
              {onIrAlDeck && (
                <ModalActionBtn
                  onClick={() => {
                    void onIrAlDeck(sub);
                    onClose();
                  }}
                  className="bg-violet-600 text-white hover:bg-violet-700 border border-violet-700"
                >
                  <span className="text-xl shrink-0" aria-hidden>
                    💫
                  </span>
                  <span>Ir al deck (swipe)</span>
                </ModalActionBtn>
              )}
              <Link
                href={`/searches/${sub.savedSearchId}`}
                onClick={onClose}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-[var(--mp-radius-chip)] bg-[var(--mp-card)] text-[var(--mp-foreground)] border border-[var(--mp-border)] font-medium hover:bg-[var(--mp-bg)]"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  ✏️
                </span>
                <span>Editar búsqueda guardada</span>
              </Link>
            </>
          )}

          <Link
            href="/searches"
            onClick={onClose}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-[var(--mp-radius-chip)] bg-[color-mix(in_srgb,var(--mp-muted)_10%,var(--mp-card))] text-[var(--mp-foreground)] border border-[var(--mp-border)] font-medium hover:bg-[color-mix(in_srgb,var(--mp-muted)_16%,var(--mp-card))]"
          >
            <span className="text-xl shrink-0" aria-hidden>
              📂
            </span>
            <span>Ver todas mis búsquedas</span>
          </Link>

          <ModalActionBtn
            onClick={handleDelete}
            className="bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
          >
            <span className="text-xl shrink-0" aria-hidden>
              🗑️
            </span>
            <span>Eliminar esta alerta</span>
          </ModalActionBtn>

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
