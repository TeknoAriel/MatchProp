'use client';

import Link from 'next/link';
import { formatListingPrice } from '../lib/format-price';
import ListingCardImageCarousel from './ListingCardImageCarousel';

export interface ListingCardMiniData {
  id: string;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  locationText?: string | null;
  heroImageUrl?: string | null;
  media?: { url: string; sortOrder: number; type?: string | null }[];
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaTotal?: number | null;
  propertyType?: string | null;
  operationType?: string | null;
}

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Depto',
  HOUSE: 'Casa',
  LAND: 'Terreno',
  OFFICE: 'Oficina',
  OTHER: 'Propiedad',
};

const OPERATION_LABEL: Record<string, string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
};

/** Título o fallback legible cuando title está vacío */
function displayTitle(listing: ListingCardMiniData): string {
  if (listing.title && listing.title.trim()) return listing.title;
  const parts: string[] = [];
  if (listing.propertyType)
    parts.push(PROPERTY_TYPE_LABEL[listing.propertyType] ?? listing.propertyType);
  if (listing.bedrooms != null) parts.push(`${listing.bedrooms} amb`);
  if (listing.locationText) parts.push(listing.locationText);
  if (parts.length) return parts.join(' · ');
  return 'Propiedad';
}

export interface ListingStatus {
  inFavorite: boolean;
  inLike: boolean;
  inLists: { id: string; name: string }[];
  lead: { status: string } | null;
}

interface ListingCardMiniProps {
  listing: ListingCardMiniData;
  href: string;
  badges?: boolean;
  compact?: boolean;
  showShareButton?: boolean;
  /** Si se pasa, se muestra "Quiero que me contacten" o estado si ya envió consulta */
  onContact?: () => void;
  /** Si se pasa, se muestra "Quitar de esta lista" */
  onRemove?: () => void;
  /** Estado: favoritos, listas guardadas, lead (para cambiar color botón contactar) */
  status?: ListingStatus | null;
  /** Callback para agregar a favoritos (muestra ★) */
  onToggleFavorite?: () => void;
  /** Callback para toggle like (muestra 👍) */
  onToggleLike?: () => void;
  /** Callback al hacer clic en "+ Lista" (abre modal en el padre) */
  onAddToList?: () => void;
}

export default function ListingCardMini({
  listing,
  href,
  badges = true,
  compact = false,
  showShareButton = false,
  onContact,
  onRemove,
  status,
  onToggleFavorite,
  onToggleLike,
  onAddToList,
}: ListingCardMiniProps) {
  const title = displayTitle(listing);
  const priceText =
    listing.price != null ? formatListingPrice(listing.price, listing.currency) : 'Consultar';
  const hasVisualContent = !!listing.heroImageUrl || (listing.media?.length ?? 0) > 0;
  const hasCoreContent =
    !!listing.title?.trim() || listing.price != null || !!listing.locationText?.trim();
  const hasIncompleteData = !hasVisualContent || !hasCoreContent;
  const hasLead = !!status?.lead;
  const leadStatus = status?.lead?.status;
  const inLists = status?.inLists ?? [];
  const inFavorite = status?.inFavorite ?? false;
  const inLike = status?.inLike ?? false;

  return (
    <div
      className={`mp-surface mp-surface-interactive overflow-hidden ${showShareButton || onContact || onRemove || onToggleFavorite || onToggleLike || onAddToList ? 'flex flex-col' : ''}`}
    >
      {/* Badges: listas guardadas (arriba) */}
      {inLists.length > 0 && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          {inLists.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--mp-radius-chip)] bg-emerald-100 text-emerald-800 text-xs font-medium"
            >
              📁 {l.name}
            </span>
          ))}
        </div>
      )}
      <Link href={href} className="block flex-1">
        <div className="mp-listing-media bg-[var(--mp-bg)] relative overflow-hidden group aspect-[4/3] min-h-[140px]">
          <ListingCardImageCarousel
            heroImageUrl={listing.heroImageUrl}
            media={listing.media}
            alt={title}
            controlsAlwaysVisible={(listing.media?.length ?? 0) > 1}
            carouselButtonClass="opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {badges && (listing.operationType || listing.propertyType) && (
            <div className="absolute top-2 left-2 z-20 flex gap-1 flex-wrap pointer-events-none">
              {listing.operationType && (
                <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium">
                  {OPERATION_LABEL[listing.operationType] ?? listing.operationType}
                </span>
              )}
              {listing.propertyType && (
                <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium">
                  {PROPERTY_TYPE_LABEL[listing.propertyType] ?? listing.propertyType}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={compact ? 'p-3' : 'p-4'}>
          <h2 className="font-bold text-[var(--mp-foreground)] truncate text-lg">{title}</h2>
          <p className="text-lg font-semibold mt-1 text-[var(--mp-accent-hover)]">{priceText}</p>
          {listing.locationText && (
            <p className="text-sm text-[var(--mp-muted)] truncate mt-1">{listing.locationText}</p>
          )}
          {hasIncompleteData && (
            <p className="text-xs text-amber-700 mt-1">
              Ficha incompleta. Abrila para ver todos los datos.
            </p>
          )}
          <div className="flex gap-3 mt-3 flex-wrap">
            {listing.bedrooms != null && (
              <span className="text-sm text-[var(--mp-muted)]">{listing.bedrooms} dorm</span>
            )}
            {listing.bathrooms != null && (
              <span className="text-sm text-[var(--mp-muted)]">{listing.bathrooms} baños</span>
            )}
            {listing.areaTotal != null && (
              <span className="text-sm text-[var(--mp-muted)]">
                {Math.round(listing.areaTotal)} m²
              </span>
            )}
          </div>
        </div>
      </Link>
      {(showShareButton ||
        onContact ||
        onRemove ||
        onToggleFavorite ||
        onToggleLike ||
        onAddToList) && (
        <div className="px-4 pb-3 pt-3 border-t border-[var(--mp-border)] space-y-2 flex flex-col gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            {onToggleLike && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleLike();
                }}
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-[var(--mp-radius-chip)] text-lg ${
                  inLike
                    ? 'bg-green-600 text-white'
                    : 'bg-[color-mix(in_srgb,var(--mp-muted)_16%,var(--mp-bg))] text-[var(--mp-muted)] hover:bg-[color-mix(in_srgb,var(--mp-muted)_22%,var(--mp-bg))]'
                }`}
                title={inLike ? 'En like' : 'Agregar a like'}
              >
                👍
              </button>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite();
                }}
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-[var(--mp-radius-chip)] text-lg ${
                  inFavorite
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
                title={inFavorite ? 'En favoritos' : 'Agregar a favoritos'}
              >
                ★
              </button>
            )}
            {onAddToList && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onAddToList();
                }}
                className="shrink-0 px-3 py-2 rounded-[var(--mp-radius-chip)] text-sm font-medium bg-[color-mix(in_srgb,var(--mp-muted)_10%,var(--mp-card))] text-[var(--mp-foreground)] hover:bg-[color-mix(in_srgb,var(--mp-muted)_16%,var(--mp-card))]"
              >
                + Lista
              </button>
            )}
            {hasLead ? (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <span
                  className={`flex-1 py-2 text-center text-sm rounded-[var(--mp-radius-chip)] font-medium ${
                    leadStatus === 'ACTIVE'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  ✓ {leadStatus === 'ACTIVE' ? 'Esperando respuesta' : 'Consulta enviada'}
                </span>
                {onContact && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onContact();
                    }}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-[var(--mp-radius-chip)] bg-[color-mix(in_srgb,var(--mp-accent)_16%,var(--mp-card))] text-[var(--mp-accent-hover)] hover:bg-[color-mix(in_srgb,var(--mp-accent)_22%,var(--mp-card))]"
                    title="Reenviar consulta"
                  >
                    ✉️
                  </button>
                )}
              </div>
            ) : onContact ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onContact();
                }}
                className="flex-1 py-2 bg-[var(--mp-accent)] text-white text-sm font-medium rounded-[var(--mp-radius-chip)] hover:bg-[var(--mp-accent-hover)] transition-colors min-w-0"
              >
                Quiero que me contacten
              </button>
            ) : null}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="w-full py-2 text-[var(--mp-muted)] text-sm hover:text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] rounded-[var(--mp-radius-chip)] transition-colors font-medium"
            >
              Quitar de esta lista
            </button>
          )}
          {showShareButton && (
            <Link
              href="/me/premium"
              className="flex items-center gap-2 text-sm text-[var(--mp-foreground)] hover:opacity-90 transition-colors font-medium"
              title="Compartir ficha — requiere Premium"
            >
              <span>📤</span>
              Compartir
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                Ver planes
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
