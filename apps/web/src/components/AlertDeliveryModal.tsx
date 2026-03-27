'use client';

import Link from 'next/link';

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  NEW_LISTING: { label: 'Nuevas publicaciones', icon: '🏠' },
  PRICE_DROP: { label: 'Bajó el precio', icon: '📉' },
  BACK_ON_MARKET: { label: 'Volvió al mercado', icon: '🔄' },
};

export type AlertDeliveryRow = {
  id: string;
  listingId: string;
  type: string;
  createdAt: string;
  listingTitle: string | null;
  listingPrice: number | null;
  listingCurrency: string | null;
  savedSearchName: string | null;
};

interface AlertDeliveryModalProps {
  open: boolean;
  delivery: AlertDeliveryRow | null;
  onClose: () => void;
}

export default function AlertDeliveryModal({ open, delivery, onClose }: AlertDeliveryModalProps) {
  if (!open || !delivery) return null;

  const typeInfo = TYPE_LABELS[delivery.type] ?? { label: delivery.type, icon: '🔔' };
  const priceText =
    delivery.listingPrice != null
      ? `${delivery.listingCurrency ?? 'USD'} ${delivery.listingPrice.toLocaleString()}`
      : 'Consultar';

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
        aria-labelledby="delivery-modal-title"
      >
        <div className="p-5 border-b border-[var(--mp-border)]">
          <h2
            id="delivery-modal-title"
            className="text-lg font-semibold text-[var(--mp-foreground)]"
          >
            Aviso disparado
          </h2>
          <p className="text-xs text-[var(--mp-muted)] mt-1">
            {typeInfo.icon} {typeInfo.label}
          </p>
          <p className="font-medium text-[var(--mp-foreground)] mt-2 line-clamp-2">
            {delivery.listingTitle ?? delivery.listingId}
          </p>
          <p className="text-sm text-sky-700 font-semibold mt-1">{priceText}</p>
          {delivery.savedSearchName && (
            <p className="text-xs text-[var(--mp-muted)] mt-1 truncate">
              Búsqueda: {delivery.savedSearchName}
            </p>
          )}
          <p className="text-xs text-[var(--mp-muted)] mt-2" suppressHydrationWarning>
            {new Date(delivery.createdAt).toLocaleString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="p-3 flex flex-col gap-2">
          <Link
            href={`/listing/${delivery.listingId}`}
            onClick={onClose}
            className="block w-full text-center px-4 py-3 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600"
          >
            Ver ficha completa
          </Link>
          <Link
            href="/me/match"
            onClick={onClose}
            className="block w-full text-center px-4 py-3 rounded-xl bg-slate-100 text-[var(--mp-foreground)] font-medium border border-[var(--mp-border)] hover:bg-slate-200/80"
          >
            Ir a Mis match
          </Link>
          <Link
            href="/searches"
            onClick={onClose}
            className="block w-full text-center px-4 py-3 rounded-xl bg-sky-50 text-sky-900 border border-sky-200 font-medium hover:bg-sky-100"
          >
            Ver mis búsquedas
          </Link>
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
