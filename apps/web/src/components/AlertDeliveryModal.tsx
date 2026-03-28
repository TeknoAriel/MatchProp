'use client';

import Link from 'next/link';
import { useState } from 'react';

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
  const [copied, setCopied] = useState(false);

  if (!open || !delivery) return null;

  const drow = delivery;
  const typeInfo = TYPE_LABELS[drow.type] ?? { label: drow.type, icon: '🔔' };
  const priceText =
    drow.listingPrice != null
      ? `${drow.listingCurrency ?? 'USD'} ${drow.listingPrice.toLocaleString()}`
      : 'Consultar';

  async function copyLink() {
    const id = drow.listingId;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/listing/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-[var(--mp-card)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto border border-emerald-200/60"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-modal-title"
      >
        <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-t-2xl sm:rounded-t-2xl">
          <h2 id="delivery-modal-title" className="text-lg font-semibold">
            Aviso disparado
          </h2>
          <p className="text-xs text-emerald-100 mt-1.5 flex items-center gap-1.5">
            <span aria-hidden>{typeInfo.icon}</span>
            {typeInfo.label}
          </p>
          <p className="font-semibold mt-3 line-clamp-2 leading-snug">
            {drow.listingTitle ?? drow.listingId}
          </p>
          <p className="text-lg font-bold text-white mt-2">{priceText}</p>
          {drow.savedSearchName && (
            <p className="text-xs text-emerald-100/90 mt-2 truncate">
              Búsqueda: {drow.savedSearchName}
            </p>
          )}
          <p className="text-xs text-emerald-100/80 mt-2" suppressHydrationWarning>
            {new Date(drow.createdAt).toLocaleString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="p-3 flex flex-col gap-2 bg-[var(--mp-bg)]">
          <Link
            href={`/listing/${drow.listingId}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600"
          >
            <span className="text-xl" aria-hidden>
              📄
            </span>
            Ver ficha completa
          </Link>
          <Link
            href="/me/match"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 border border-emerald-700"
          >
            <span className="text-xl" aria-hidden>
              💚
            </span>
            Ir a Mis match
          </Link>
          <Link
            href="/feed"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700"
          >
            <span className="text-xl" aria-hidden>
              💫
            </span>
            Ir al deck (swipe)
          </Link>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white text-[var(--mp-foreground)] font-medium border border-[var(--mp-border)] hover:bg-slate-50"
          >
            <span className="text-xl" aria-hidden>
              🔗
            </span>
            {copied ? '¡Copiado!' : 'Copiar enlace de la ficha'}
          </button>
          <Link
            href="/searches"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-slate-100 text-[var(--mp-foreground)] font-medium border border-[var(--mp-border)] hover:bg-slate-200/80"
          >
            <span className="text-xl" aria-hidden>
              🔔
            </span>
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
