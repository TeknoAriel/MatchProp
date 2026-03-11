'use client';

import Link from 'next/link';
import { getListingImageUrl } from '../lib/demo-image';

export interface ListingCardMiniData {
  id: string;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  locationText?: string | null;
  heroImageUrl?: string | null;
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
    listing.price != null
      ? `${listing.currency ?? 'USD'} ${listing.price.toLocaleString()}`
      : 'Consultar';
  const hasLead = !!status?.lead;
  const leadStatus = status?.lead?.status;
  const inLists = status?.inLists ?? [];
  const inFavorite = status?.inFavorite ?? false;
  const inLike = status?.inLike ?? false;

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-md hover:shadow-lg hover:border-slate-200 transition-all ${showShareButton || onContact || onRemove || onToggleFavorite || onToggleLike || onAddToList ? 'flex flex-col' : ''}`}
    >
      {/* Badges: listas guardadas (arriba) */}
      {inLists.length > 0 && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          {inLists.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium"
            >
              📁 {l.name}
            </span>
          ))}
        </div>
      )}
      <Link href={href} className="block flex-1">
        <div className="aspect-video bg-slate-200 relative">
          {getListingImageUrl(listing.id, listing.heroImageUrl) ? (
            <img
              src={getListingImageUrl(listing.id, listing.heroImageUrl)!}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              Sin imagen
            </div>
          )}
          {badges && (listing.operationType || listing.propertyType) && (
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
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
          <h2 className="font-bold text-slate-900 truncate text-lg">{title}</h2>
          <p className="text-lg font-semibold text-blue-700 mt-1">{priceText}</p>
          {listing.locationText && (
            <p className="text-sm text-slate-600 truncate mt-1">{listing.locationText}</p>
          )}
          <div className="flex gap-3 mt-3 flex-wrap">
            {listing.bedrooms != null && (
              <span className="text-sm text-slate-600">{listing.bedrooms} dorm</span>
            )}
            {listing.bathrooms != null && (
              <span className="text-sm text-slate-600">{listing.bathrooms} baños</span>
            )}
            {listing.areaTotal != null && (
              <span className="text-sm text-slate-600">{Math.round(listing.areaTotal)} m²</span>
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
        <div className="px-4 pb-3 pt-3 border-t border-slate-100 space-y-2 flex flex-col gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            {onToggleLike && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleLike();
                }}
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                  inLike
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
                className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
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
                className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                + Lista
              </button>
            )}
            {hasLead ? (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <span
                  className={`flex-1 py-2 text-center text-sm rounded-xl font-medium ${
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
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
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
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-w-0"
              >
                Quiero que me contacten
              </button>
            ) : null}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="w-full py-2 text-slate-700 text-sm hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors font-medium"
            >
              Quitar de esta lista
            </button>
          )}
          {showShareButton && (
            <Link
              href="/me/premium"
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium"
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
