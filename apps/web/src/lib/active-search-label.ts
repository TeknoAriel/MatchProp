import { filtersToHumanSummary } from './filters-summary';
import type { SearchFilters } from '@matchprop/shared';

export type ActiveSearchLike = {
  name: string;
  queryText: string | null;
  filters: SearchFilters;
};

/** Una línea legible para barra y contexto de asistente. */
export function buildBuscandoLine(search: ActiveSearchLike): string {
  const name = search.name?.trim() ?? '';
  const human = filtersToHumanSummary(search.filters)?.trim() ?? '';
  const q = search.queryText?.trim() ?? '';
  const parts = [name, human].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (q) return q.length > 120 ? `${q.slice(0, 117)}…` : q;
  return 'Tu búsqueda activa';
}
