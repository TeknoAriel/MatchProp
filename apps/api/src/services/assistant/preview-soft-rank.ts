/**
 * Reordenación leve por señales blandas (título + zona). No filtra: solo prioriza en preview.
 */
/** Compatible con cards del feed (id/propertyType + texto para señales). */
export type SoftRankItem = {
  id?: string;
  title?: string | null;
  locationText?: string | null;
  propertyType?: string | null;
};

function signalToTerms(signal: string): string[] {
  const s = signal.toLowerCase();
  if (s.includes('familia') || s === 'familia')
    return ['familia', 'dormitorio', 'jardín', 'jardin', 'patio', 'niños'];
  if (s.includes('verde')) return ['verde', 'jardín', 'jardin', 'parque', 'pileta'];
  if (s.includes('luminoso')) return ['luminoso', 'luz', 'ventanal', 'vista'];
  if (s.includes('moderno')) return ['moderno', 'a estrenar', 'nuevo'];
  if (s.includes('tranquilo')) return ['tranquilo', 'residencial'];
  if (s.includes('compacto')) return ['monoambiente', 'compacto', 'pequeño'];
  return [signal];
}

export function softSignalScore(item: SoftRankItem, signals: string[]): number {
  if (!signals.length) return 0;
  const blob = `${item.title ?? ''} ${item.locationText ?? ''}`.toLowerCase();
  let score = 0;
  for (const sig of signals) {
    for (const term of signalToTerms(sig)) {
      if (term.length > 2 && blob.includes(term.toLowerCase())) score += 1;
    }
  }
  return score;
}

export function reorderBySoftSignals<T extends SoftRankItem>(items: T[], signals: string[]): T[] {
  if (!signals.length || items.length <= 1) return items;
  const scored = items.map((it, idx) => ({
    it,
    idx,
    s: softSignalScore(it, signals),
  }));
  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    return a.idx - b.idx;
  });
  return scored.map((x) => x.it);
}
