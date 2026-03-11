'use client';

/**
 * Filtros de búsqueda reutilizables: Venta/Alquiler arriba, tipos de propiedad abajo.
 * Estética KiteProp: colores distintos para activos, jerarquía visual clara.
 */
export const PROPERTY_TYPE_CHIPS = [
  { value: 'HOUSE', label: 'Casa' },
  { value: 'APARTMENT', label: 'Depto' },
  { value: 'LAND', label: 'Terreno' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'OTHER', label: 'Otro' },
] as const;

type OperationFilter = 'SALE' | 'RENT' | null;

type FilterChipsProps = {
  operationFilter: OperationFilter;
  propertyTypeFilter: string | null;
  onOperationChange: (value: OperationFilter) => void;
  onPropertyTypeChange: (value: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function FilterChips({
  operationFilter,
  propertyTypeFilter,
  onOperationChange,
  onPropertyTypeChange,
  disabled = false,
  compact = false,
}: FilterChipsProps) {
  const pad = compact ? 'px-2.5 py-1 rounded-lg text-xs' : 'px-3 py-1.5 rounded-xl text-sm';
  const base = `font-medium transition-all duration-200 ${pad} disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Operación
        </span>
        <button
          type="button"
          onClick={() => onOperationChange(operationFilter === 'SALE' ? null : 'SALE')}
          disabled={disabled}
          className={`${base} ${
            operationFilter === 'SALE'
              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Venta
        </button>
        <button
          type="button"
          onClick={() => onOperationChange(operationFilter === 'RENT' ? null : 'RENT')}
          disabled={disabled}
          className={`${base} ${
            operationFilter === 'RENT'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Alquiler
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</span>
        {PROPERTY_TYPE_CHIPS.map(({ value, label }) => {
          const isActive = propertyTypeFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPropertyTypeChange(isActive ? null : value)}
              disabled={disabled}
              className={`${base} ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
