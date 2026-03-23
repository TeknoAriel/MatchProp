'use client';

import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import { filtersToHumanSummary } from '../lib/filters-summary';

export type AlertTypeSaved = 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
export type SubStateSaved = { id: string; isEnabled: boolean } | null;
export type AlertDeliverySaved = {
  id: string;
  listingId: string;
  type: string;
  createdAt: string;
  listingTitle: string | null;
  listingPrice: number | null;
  listingCurrency: string | null;
};

const ALERT_LABELS: Record<AlertTypeSaved, string> = {
  NEW_LISTING: 'Nuevas publicaciones',
  PRICE_DROP: 'Bajó precio',
  BACK_ON_MARKET: 'Volvió al mercado',
};

type Props = {
  s: SavedSearchDTO;
  activeSearchId: string | null;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  subsBySearch: Record<string, Record<AlertTypeSaved, SubStateSaved>>;
  deliveriesBySearch: Record<string, AlertDeliverySaved[]>;
  onMatch: (searchId: string) => void;
  onEditOpen: (s: SavedSearchDTO) => void;
  onSetActive: (searchId: string) => void;
  onDelete: (searchId: string) => void;
  onAlert: (searchId: string, type: AlertTypeSaved, enable: boolean) => void;
};

export default function SavedSearchCard({
  s,
  activeSearchId,
  expandedId,
  onToggleExpand,
  deleteConfirmId,
  setDeleteConfirmId,
  subsBySearch,
  deliveriesBySearch,
  onMatch,
  onEditOpen,
  onSetActive,
  onDelete,
  onAlert,
}: Props) {
  const expanded = expandedId === s.id;

  return (
    <div className="p-4 rounded-xl bg-[var(--mp-card)] shadow-sm border border-[var(--mp-border)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-[var(--mp-foreground)]">
            {s.name || 'Búsqueda sin nombre'}
          </h2>
          <p className="text-sm text-[var(--mp-muted)] mt-0.5 break-words">
            {s.queryText || filtersToHumanSummary(s.filters) || 'Sin criterios'}
          </p>
          <p className="text-xs text-[var(--mp-muted)] mt-1" suppressHydrationWarning>
            {typeof s.updatedAt === 'string'
              ? new Date(s.updatedAt).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMatch(s.id)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-600"
            title="Buscar en modo Match"
          >
            Match
          </button>
          <button
            type="button"
            onClick={() => onEditOpen(s)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            title="Editar"
          >
            ✏️
          </button>
          {activeSearchId === s.id ? (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Activa
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSetActive(s.id)}
              className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              Activar
            </button>
          )}
          {deleteConfirmId === s.id ? (
            <>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-2 py-1 text-xs text-slate-600 hover:underline"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirmId(s.id)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
              title="Eliminar"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleExpand(s.id)}
        className="mt-2 text-sm text-sky-600 hover:underline"
      >
        {expanded ? 'Ocultar' : 'Ver'} alertas y resultados
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-[var(--mp-border)]">
          <div>
            <p className="text-sm font-medium text-[var(--mp-foreground)] mb-2">Activar alertas</p>
            <div className="flex flex-wrap gap-2">
              {(['NEW_LISTING', 'PRICE_DROP', 'BACK_ON_MARKET'] as AlertTypeSaved[]).map((type) => {
                const sub = subsBySearch[s.id]?.[type];
                const isOn = sub?.isEnabled ?? false;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onAlert(s.id, type, !isOn)}
                    className={`px-2 py-1 text-xs rounded-full ${
                      isOn
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ALERT_LABELS[type]} {isOn ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--mp-foreground)] mb-2">
              Resultado de alertas para esta búsqueda
            </p>
            {(deliveriesBySearch[s.id] ?? []).length === 0 ? (
              <p className="text-sm text-[var(--mp-muted)]">Aún no hay alertas disparadas.</p>
            ) : (
              <ul className="space-y-1">
                {(deliveriesBySearch[s.id] ?? []).map((d) => (
                  <li key={d.id} className="text-sm flex justify-between gap-2">
                    <span className="truncate">{d.listingTitle ?? d.listingId}</span>
                    <span className="text-[var(--mp-muted)] shrink-0">
                      {d.listingPrice != null
                        ? `${d.listingCurrency ?? 'USD'} ${d.listingPrice.toLocaleString()}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/searches/${s.id}`}
              className="text-xs text-sky-600 hover:underline mt-1 inline-block"
            >
              Ver resultados completos →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditSearchModal({
  open,
  editName,
  editText,
  editSaving,
  onEditName,
  onEditText,
  onSave,
  onClose,
}: {
  open: boolean;
  editName: string;
  editText: string;
  editSaving: boolean;
  onEditName: (v: string) => void;
  onEditText: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--mp-card)] rounded-2xl shadow-xl max-w-md w-full p-5 border border-[var(--mp-border)]">
        <h3 className="font-bold text-[var(--mp-foreground)] mb-4">Editar búsqueda</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--mp-muted)] block mb-1">Nombre</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--mp-border)] rounded-xl bg-[var(--mp-bg)] text-[var(--mp-foreground)]"
              placeholder="Ej: Casa 3 amb Funes"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--mp-muted)] block mb-1">
              Texto de búsqueda (opcional, min 3 caracteres)
            </label>
            <input
              type="text"
              value={editText}
              onChange={(e) => onEditText(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--mp-border)] rounded-xl bg-[var(--mp-bg)] text-[var(--mp-foreground)]"
              placeholder="Ej: casa 3 dormitorios en Funes hasta 150000 USD"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={editSaving}
            className="px-4 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 disabled:opacity-50"
          >
            {editSaving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[var(--mp-muted)] hover:bg-[var(--mp-bg)] rounded-xl"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
