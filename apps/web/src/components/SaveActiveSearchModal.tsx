'use client';

import { useEffect, useState } from 'react';
import type { SearchFilters } from '@matchprop/shared';
import { filtersToHumanSummary } from '../lib/filters-summary';
import { notifyActiveSearchChanged } from '../lib/activeSearchEvents';

const API_BASE = '/api';

export type SaveActiveSearchModalProps = {
  open: boolean;
  onClose: () => void;
  /** Si hay id, se puede actualizar la misma fila en lugar de crear otra. */
  savedSearchId?: string | null;
  initialName: string;
  initialText: string;
  initialFilters: SearchFilters;
  onSuccess?: (payload: { id: string; mode: 'created' | 'updated' }) => void;
};

export default function SaveActiveSearchModal({
  open,
  onClose,
  savedSearchId,
  initialName,
  initialText,
  initialFilters,
  onSuccess,
}: SaveActiveSearchModalProps) {
  const [name, setName] = useState(initialName);
  const [text, setText] = useState(initialText);
  const [asCopy, setAsCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLine, setDetailLine] = useState(() => filtersToHumanSummary(initialFilters));

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setText(initialText);
    setDetailLine(filtersToHumanSummary(initialFilters));
    setError(null);
    setAsCopy(true);
  }, [open, initialName, initialText, initialFilters]);

  async function resolveFiltersFromText(t: string): Promise<SearchFilters> {
    const trimmed = t.trim();
    if (!trimmed || trimmed.length < 3) {
      return initialFilters;
    }
    const res = await fetch(`${API_BASE}/assistant/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? 'No se pudo interpretar el texto');
    }
    const data = (await res.json()) as { filters?: SearchFilters };
    return (data.filters ?? {}) as SearchFilters;
  }

  async function handleSubmit() {
    const nameTrim = name.trim() || 'Mi búsqueda';
    const textTrim = text.trim();
    setBusy(true);
    setError(null);
    try {
      const filters: SearchFilters =
        textTrim === initialText.trim() ? initialFilters : await resolveFiltersFromText(textTrim);
      setDetailLine(filtersToHumanSummary(filters));

      const updateInPlace = Boolean(savedSearchId) && !asCopy;

      if (updateInPlace) {
        const res = await fetch(`${API_BASE}/searches/${savedSearchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: nameTrim,
            text: textTrim || undefined,
            filters,
          }),
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? 'Error al actualizar');
        }
        const data = (await res.json()) as { id: string };
        await fetch(`${API_BASE}/me/active-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ searchId: data.id }),
        });
        notifyActiveSearchChanged();
        onSuccess?.({ id: data.id, mode: 'updated' });
        onClose();
        return;
      }

      const res = await fetch(`${API_BASE}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: nameTrim.slice(0, 100),
          text: textTrim || undefined,
          filters,
        }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? 'Error al guardar');
      }
      const data = (await res.json()) as { id: string };
      notifyActiveSearchChanged();
      onSuccess?.({ id: data.id, mode: 'created' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div
        className="w-full sm:max-w-md rounded-t-[var(--mp-radius-card)] sm:rounded-[var(--mp-radius-card)] bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-lg max-h-[90vh] overflow-y-auto safe-area-pb"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-search-title"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--mp-border)] flex items-center justify-between gap-2">
          <h2 id="save-search-title" className="text-lg font-semibold text-[var(--mp-foreground)]">
            Guardar búsqueda
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-full text-[var(--mp-muted)] hover:bg-[var(--mp-bg)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs text-[var(--mp-muted)] leading-relaxed">
            Podés ajustar el título y el texto. Si cambiás el texto, volvemos a interpretar filtros
            con la IA (como en búsquedas guardadas).
          </p>
          {savedSearchId ? (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={asCopy}
                onChange={(e) => setAsCopy(e.target.checked)}
                className="mt-1 rounded border-[var(--mp-border)]"
              />
              <span className="text-sm text-[var(--mp-foreground)]">
                Guardar como <strong>nueva</strong> copia (si no, se actualiza la búsqueda actual)
              </span>
            </label>
          ) : null}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--mp-muted)] mb-1">
              Título
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-[var(--mp-radius-chip)] border border-[var(--mp-border)] bg-[var(--mp-bg)] text-[var(--mp-foreground)] text-sm"
              placeholder="Ej.: Depto Rosario"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--mp-muted)] mb-1">
              Búsqueda en tus palabras
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-[var(--mp-radius-chip)] border border-[var(--mp-border)] bg-[var(--mp-bg)] text-[var(--mp-foreground)] text-sm resize-y min-h-[100px]"
              placeholder="Describí zona, tipo, precio…"
            />
          </div>
          <div className="rounded-[var(--mp-radius-chip)] border border-[var(--mp-border)] bg-[color-mix(in_srgb,var(--mp-accent)_6%,var(--mp-card))] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mp-muted)] mb-1">
              Detalle interpretado
            </p>
            <p className="text-sm text-[var(--mp-foreground)] leading-snug">
              {detailLine?.trim() ? detailLine : 'Se actualizará al guardar si cambiaste el texto.'}
            </p>
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-[44px] px-4 rounded-full text-sm font-medium border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy}
              className="min-h-[44px] px-5 rounded-full text-sm font-semibold bg-[var(--mp-accent)] text-white border border-[var(--mp-accent-hover)] hover:opacity-[0.96] disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
