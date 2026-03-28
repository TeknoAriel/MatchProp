import type { SearchFilters } from '@matchprop/shared';

const PROPERTY_LABELS: Record<string, string> = {
  APARTMENT: 'departamento',
  HOUSE: 'casa',
  LAND: 'terreno',
  OFFICE: 'local comercial',
  OTHER: 'otro',
};

export type SearchFilterChip = { id: string; label: string };

/** Chips para mostrar bajo el campo de búsqueda (filtros activos interpretados). */
export function searchFiltersToChips(f: SearchFilters | null | undefined): SearchFilterChip[] {
  if (!f || typeof f !== 'object') return [];
  const chips: SearchFilterChip[] = [];

  if (f.operationType) {
    chips.push({
      id: 'op',
      label: f.operationType === 'SALE' ? 'Venta' : 'Alquiler',
    });
  }
  if (f.propertyType?.length) {
    for (const pt of f.propertyType) {
      chips.push({
        id: `pt:${pt}`,
        label: PROPERTY_LABELS[pt] ?? pt.toLowerCase(),
      });
    }
  }
  if (f.locationText?.trim()) {
    chips.push({ id: 'loc', label: `Zona: ${f.locationText.trim()}` });
  }
  if (f.addressText?.trim()) {
    chips.push({ id: 'addr', label: `Dirección: ${f.addressText.trim().slice(0, 40)}` });
  }
  if (f.bedroomsMin != null && f.bedroomsMin > 0) {
    chips.push({ id: 'bedmin', label: `≥${f.bedroomsMin} dorm.` });
  }
  if (f.bedroomsMax != null) {
    chips.push({ id: 'bedmax', label: `≤${f.bedroomsMax} dorm.` });
  }
  if (f.bathroomsMin != null && f.bathroomsMin > 0) {
    chips.push({ id: 'bathmin', label: `≥${f.bathroomsMin} baños` });
  }
  if (f.priceMax != null) {
    const c = f.currency ?? '';
    chips.push({ id: 'pmax', label: `Hasta ${c} ${f.priceMax.toLocaleString()}`.trim() });
  }
  if (f.priceMin != null && f.priceMin > 0) {
    const c = f.currency ?? '';
    chips.push({ id: 'pmin', label: `Desde ${c} ${f.priceMin.toLocaleString()}`.trim() });
  }
  if (f.areaMin != null && f.areaMin > 0) {
    chips.push({ id: 'amin', label: `≥${f.areaMin} m²` });
  }
  if (f.areaMax != null) {
    chips.push({ id: 'amax', label: `≤${f.areaMax} m²` });
  }
  if (f.areaCoveredMin != null && f.areaCoveredMin > 0) {
    chips.push({ id: 'acov', label: `Cubiertos ≥${f.areaCoveredMin} m²` });
  }
  if (f.amenities?.length) {
    f.amenities.forEach((a, i) => {
      chips.push({ id: `am:${i}:${a}`, label: a });
    });
  }
  if (f.aptoCredito === true) {
    chips.push({ id: 'acred', label: 'Apto crédito' });
  }
  if (f.keywords?.length) {
    chips.push({ id: 'kw', label: `Palabras: ${f.keywords.slice(0, 4).join(', ')}` });
  }
  if (f.sortBy) {
    const sortLabels: Record<string, string> = {
      price_asc: 'Orden: más barato',
      price_desc: 'Orden: más caro',
      area_desc: 'Orden: más grande',
      date_desc: 'Orden: más reciente',
    };
    chips.push({ id: 'sort', label: sortLabels[f.sortBy] ?? f.sortBy });
  }
  if (f.source) {
    chips.push({ id: 'src', label: `Origen: ${f.source}` });
  }

  return chips;
}

export function filtersToHumanSummary(f: SearchFilters | null | undefined): string {
  if (!f || typeof f !== 'object') return 'Sin filtros específicos';
  const parts: string[] = [];

  if (f.operationType) {
    parts.push(f.operationType === 'SALE' ? 'Venta' : 'Alquiler');
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

  if (f.amenities?.length) {
    parts.push(`con ${f.amenities.join(', ')}`);
  }

  if (f.aptoCredito === true) {
    parts.push('apto crédito');
  }

  return parts.length ? parts.join(' · ') : 'Sin filtros específicos';
}
