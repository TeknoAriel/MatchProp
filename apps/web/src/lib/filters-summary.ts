import type { SearchFilters } from '@matchprop/shared';

const PROPERTY_LABELS: Record<string, string> = {
  APARTMENT: 'departamento',
  HOUSE: 'casa',
  LAND: 'terreno',
  OFFICE: 'local comercial',
  OTHER: 'otro',
};

export function filtersToHumanSummary(f: SearchFilters | null | undefined): string {
  if (!f || typeof f !== 'object') return 'Sin filtros específicos';
  const parts: string[] = [];

  if (f.operationType) {
    parts.push(f.operationType === 'SALE' ? 'Compra' : 'Alquiler');
  }

  if (f.propertyType?.length) {
    const labels = f.propertyType.map((pt) => PROPERTY_LABELS[pt] ?? pt.toLowerCase());
    parts.push(labels.join(' / '));
  }

  if (f.locationText) {
    parts.push(`Zona: ${f.locationText}`);
  }

  if (f.bedroomsMin != null && f.bedroomsMin > 0) {
    parts.push(`≥${f.bedroomsMin} dormitorios`);
  }

  if (f.bathroomsMin != null && f.bathroomsMin > 0) {
    parts.push(`≥${f.bathroomsMin} baños`);
  }

  if (f.priceMax != null) {
    const curr = f.currency ?? 'USD';
    parts.push(`hasta ${curr} ${f.priceMax.toLocaleString()}`);
  }

  if (f.priceMin != null && f.priceMin > 0) {
    const curr = f.currency ?? 'USD';
    parts.push(`desde ${curr} ${f.priceMin.toLocaleString()}`);
  }

  if (f.areaMin != null && f.areaMin > 0) {
    parts.push(`desde ${f.areaMin} m²`);
  }

  return parts.length ? parts.join(' · ') : 'Sin filtros específicos';
}
