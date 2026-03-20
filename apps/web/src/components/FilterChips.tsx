'use client';

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
  const sz = compact ? 'text-xs px-2.5 py-1' : 'text-xs px-3 py-1.5';
  const idle = 'bg-[var(--mp-bg)] text-[var(--mp-muted)] border border-[var(--mp-border)]';
  const chip = `${sz} rounded-full font-medium transition-all duration-150 disabled:opacity-40`;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <button
        type="button"
        onClick={() => onOperationChange(operationFilter === 'SALE' ? null : 'SALE')}
        disabled={disabled}
        className={`${chip} ${
          operationFilter === 'SALE' ? 'bg-violet-600 text-white border border-violet-600' : idle
        }`}
      >
        Venta
      </button>
      <button
        type="button"
        onClick={() => onOperationChange(operationFilter === 'RENT' ? null : 'RENT')}
        disabled={disabled}
        className={`${chip} ${
          operationFilter === 'RENT' ? 'bg-rose-500 text-white border border-rose-500' : idle
        }`}
      >
        Alquiler
      </button>

      <span className="w-px h-4 bg-[var(--mp-border)] mx-1" />

      {PROPERTY_TYPE_CHIPS.map(({ value, label }) => {
        const isActive = propertyTypeFilter === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPropertyTypeChange(isActive ? null : value)}
            disabled={disabled}
            className={`${chip} ${isActive ? 'bg-sky-600 text-white border border-sky-600' : idle}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
