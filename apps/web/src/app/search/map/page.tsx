'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import { formatListingPrice } from '../../../lib/format-price';
import 'leaflet/dist/leaflet.css';

const API_BASE = '/api';

type MapMedia = { url: string; sortOrder: number };
type MapListingCard = ListingCard & { lat: number; lng: number; media?: MapMedia[] };
type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const DEFAULT_CENTER = { lat: -32.9468, lng: -60.6393 }; // Rosario

function normalizeCard(raw: unknown): MapListingCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  const lat = typeof c.lat === 'number' ? c.lat : null;
  const lng = typeof c.lng === 'number' ? c.lng : null;
  if (!id || lat == null || lng == null) return null;

  const media: MapMedia[] | undefined = Array.isArray(c.media)
    ? c.media
        .map((m) => {
          if (!m || typeof m !== 'object') return null;
          const mm = m as Record<string, unknown>;
          const url = typeof mm.url === 'string' && mm.url ? mm.url : null;
          const sortOrder = typeof mm.sortOrder === 'number' ? mm.sortOrder : null;
          if (!url || sortOrder == null) return null;
          return { url, sortOrder };
        })
        .filter((x): x is MapMedia => x !== null)
    : undefined;

  return {
    id,
    lat,
    lng,
    title: typeof c.title === 'string' ? c.title : null,
    price: typeof c.price === 'number' ? c.price : null,
    currency: typeof c.currency === 'string' ? c.currency : null,
    bedrooms: typeof c.bedrooms === 'number' ? c.bedrooms : null,
    bathrooms: typeof c.bathrooms === 'number' ? c.bathrooms : null,
    areaTotal: typeof c.areaTotal === 'number' ? c.areaTotal : null,
    locationText: typeof c.locationText === 'string' ? c.locationText : null,
    heroImageUrl:
      typeof c.heroImageUrl === 'string' && c.heroImageUrl
        ? c.heroImageUrl
        : (media?.[0]?.url ?? null),
    media,
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'KITEPROP_EXTERNALSITE',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
  };
}

function normalizeItems(raw: unknown): MapListingCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCard).filter((c): c is MapListingCard => c !== null);
}

const MapView = dynamic(() => import('../../../components/SearchMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center text-slate-500">
      Cargando mapa...
    </div>
  ),
});

export default function SearchMapPage() {
  const router = useRouter();
  const [items, setItems] = useState<MapListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedImgError, setSelectedImgError] = useState(false);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/feed/map?limit=200`, { credentials: 'include' })
      .then((res) => {
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.items) {
          const normalized = normalizeItems(data.items);
          setItems(normalized);
          const first = normalized[0];
          if (first) {
          setCenter({ lat: first.lat, lng: first.lng });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleBoundsChange = useCallback((b: Bounds) => {
    fetch(
      `${API_BASE}/feed/map?limit=200&minLat=${b.minLat}&maxLat=${b.maxLat}&minLng=${b.minLng}&maxLng=${b.maxLng}`,
      { credentials: 'include' }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items) setItems(normalizeItems(data.items));
      })
      .catch(() => {});
  }, []);

  const bounds: [[number, number], [number, number]] = useMemo(() => {
    if (items.length > 0) {
      const lats = items.map((p) => p.lat);
      const lngs = items.map((p) => p.lng);
      return [
        [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
        [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
      ];
    }
    return [
      [center.lat - 0.1, center.lng - 0.1],
      [center.lat + 0.1, center.lng + 0.1],
    ];
  }, [items, center]);

  const selectedItem = items.find((i) => i.id === selectedId);

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedImgError(false);
  }, [selectedId]);

  const selectedImages: { url: string; sortOrder: number }[] = selectedItem?.media?.length
    ? [...selectedItem.media].sort((a, b) => a.sortOrder - b.sortOrder)
    : selectedItem?.heroImageUrl
      ? [{ url: selectedItem.heroImageUrl, sortOrder: 0 }]
      : [];

  const selectedCurrentImage = selectedImages[selectedImageIndex];
  const selectedHasMultiple = selectedImages.length > 1;

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-[var(--mp-bg)]">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="h-[calc(100vh-4rem)] md:h-screen flex flex-col bg-[var(--mp-bg)]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-[var(--mp-card)] border-b border-[var(--mp-border)] flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--mp-foreground)]">Mapa</h1>
          <p className="text-xs text-[var(--mp-muted)]">{items.length} propiedades</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowList(!showList)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showList ? 'bg-sky-500 text-white' : 'bg-[var(--mp-bg)] text-[var(--mp-muted)]'
            }`}
          >
            {showList ? '📋 Lista' : '📋'}
          </button>
          <Link
            href="/feed/list"
            className="px-3 py-1.5 rounded-lg text-sm bg-[var(--mp-bg)] text-[var(--mp-muted)] hover:text-[var(--mp-foreground)]"
          >
            Ver lista completa
          </Link>
        </div>
      </div>

      {/* Map + List container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Map */}
        <div className={`relative ${showList ? 'h-[50%] md:h-full md:flex-1' : 'h-full flex-1'}`}>
            <MapView
            items={items.map((i) => ({
              id: i.id,
              lat: i.lat,
              lng: i.lng,
              title: i.title,
              price: i.price,
              currency: i.currency ?? null,
              locationText: i.locationText,
            }))}
              center={[center.lat, center.lng]}
              bounds={bounds}
              onBoundsChange={handleBoundsChange}
            />
          </div>

        {/* Property List - Horizontal scroll on mobile, vertical on desktop */}
        {showList && (
          <div className="h-[50%] md:h-full md:w-96 bg-[var(--mp-card)] border-t md:border-t-0 md:border-l border-[var(--mp-border)] overflow-hidden flex flex-col">
            {/* Horizontal scroll on mobile */}
            <div className="md:hidden flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 p-3 h-full">
                {items.slice(0, 30).map((card) => (
                  <PropertyCardHorizontal
                    key={card.id}
                    card={card}
                    isSelected={card.id === selectedId}
                    onClick={() => {
                      setSelectedId(card.id);
                      setCenter({ lat: card.lat, lng: card.lng });
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Vertical scroll on desktop */}
            <div className="hidden md:block flex-1 overflow-y-auto p-3 space-y-3">
              {items.slice(0, 50).map((card) => (
                <PropertyCardVertical
                  key={card.id}
                  card={card}
                  isSelected={card.id === selectedId}
                  onClick={() => {
                    setSelectedId(card.id);
                    setCenter({ lat: card.lat, lng: card.lng });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected property detail (mobile floating card) */}
      {selectedItem && (
        <div className="md:hidden fixed bottom-20 left-4 right-4 z-20">
          <div className="bg-[var(--mp-card)] rounded-2xl shadow-lg border border-[var(--mp-border)] overflow-hidden">
            <div className="flex">
              <div className="w-24 h-24 shrink-0 relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                {selectedCurrentImage?.url && !selectedImgError ? (
                  <img
                    src={selectedCurrentImage.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setSelectedImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <span className="text-2xl mb-1">🏠</span>
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}

                {selectedHasMultiple && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedImgError(false);
                        setSelectedImageIndex((i) => (i <= 0 ? selectedImages.length - 1 : i - 1));
                      }}
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md cursor-pointer"
                      aria-label="Imagen anterior"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                        setSelectedImgError(false);
                        setSelectedImageIndex((i) => (i >= selectedImages.length - 1 ? 0 : i + 1));
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md cursor-pointer"
                      aria-label="Siguiente imagen"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                                  </button>

                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                      {selectedImages.map((_, idx) => (
                        <div
                          key={`selected-dot-${idx}`}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedImgError(false);
                            setSelectedImageIndex(idx);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedImgError(false);
                            setSelectedImageIndex(idx);
                          }}
                          className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                            idx === selectedImageIndex
                              ? 'bg-white scale-125'
                              : 'bg-white/60 hover:bg-white/80'
                          }`}
                          aria-label={`Ir a imagen ${idx + 1}`}
                        />
                              ))}
                            </div>

                    <span className="absolute top-1 right-1 text-[10px] bg-black/60 text-white px-2 py-1 rounded-full font-medium">
                      📷 {selectedImageIndex + 1}/{selectedImages.length}
                            </span>
                  </>
                            )}
                          </div>
              <div className="flex-1 p-3 min-w-0">
                <h3 className="font-medium text-sm truncate text-[var(--mp-foreground)]">
                  {selectedItem.title || 'Propiedad'}
                </h3>
                <p className="text-sm font-semibold text-sky-600">
                  {formatListingPrice(selectedItem.price, selectedItem.currency)}
                </p>
                <p className="text-xs text-[var(--mp-muted)] truncate">
                  {selectedItem.locationText}
                </p>
                <Link
                  href={`/listing/${selectedItem.id}`}
                  className="mt-2 inline-block text-xs text-sky-600 font-medium"
                >
                  Ver detalle →
                </Link>
                        </div>
              <button onClick={() => setSelectedId(null)} className="p-2 text-[var(--mp-muted)]">
                ✕
                        </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PropertyCardHorizontal({
  card,
  isSelected,
  onClick,
}: {
  card: MapListingCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImgError(false);
  }, [imageIndex]);

  const images: { url: string; sortOrder: number }[] = card.media?.length
    ? [...card.media].sort((a, b) => a.sortOrder - b.sortOrder)
    : card.heroImageUrl
      ? [{ url: card.heroImageUrl, sortOrder: 0 }]
      : [];

  const currentImage = images[imageIndex];
  const hasMultiple = images.length > 1;

  return (
                        <button
      onClick={onClick}
      className={`shrink-0 w-52 h-full rounded-xl overflow-hidden border transition-all text-left bg-white ${
        isSelected
          ? 'border-sky-500 shadow-lg scale-[1.02]'
          : 'border-[var(--mp-border)] hover:border-sky-300 hover:shadow-md'
      }`}
    >
      <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden group">
        {currentImage?.url && !imgError ? (
          <img
            src={currentImage.url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <span className="text-3xl mb-1">🏠</span>
            <span className="text-xs">Sin imagen</span>
          </div>
        )}

        {hasMultiple && (
          <>
            <div
              role="button"
              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                e.stopPropagation();
                setImgError(false);
                setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                setImgError(false);
                setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Imagen anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
                          </div>

            <div
              role="button"
              tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                e.stopPropagation();
                setImgError(false);
                setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                setImgError(false);
                setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Siguiente imagen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, idx) => (
                <div
                  key={`${card.id}-dot-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImgError(false);
                    setImageIndex(idx);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    e.stopPropagation();
                    setImgError(false);
                    setImageIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    idx === imageIndex ? 'bg-white scale-125' : 'bg-white/60 hover:bg-white/80'
                  }`}
                  aria-label={`Ir a imagen ${idx + 1}`}
                />
              ))}
            </div>

            <span className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-full font-medium">
              📷 {imageIndex + 1}/{images.length}
            </span>
          </>
        )}

        {card.operationType && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full font-medium">
            {card.operationType === 'SALE' ? 'Venta' : 'Alquiler'}
          </span>
                        )}
                      </div>
      <div className="p-2.5">
        <p className="text-sm font-bold text-sky-600 truncate">
          {formatListingPrice(card.price, card.currency)}
        </p>
        <p className="text-xs text-[var(--mp-foreground)] truncate font-medium mt-0.5">
          {card.title || 'Propiedad'}
        </p>
        <p className="text-xs text-[var(--mp-muted)] truncate">{card.locationText}</p>
        {card.bedrooms && (
          <p className="text-xs text-[var(--mp-muted)] mt-1">
            {card.bedrooms} amb {card.areaTotal ? `· ${card.areaTotal}m²` : ''}
              </p>
            )}
          </div>
    </button>
  );
}

function PropertyCardVertical({
  card,
  isSelected,
  onClick,
}: {
  card: MapListingCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImgError(false);
  }, [imageIndex]);

  const images: { url: string; sortOrder: number }[] = card.media?.length
    ? [...card.media].sort((a, b) => a.sortOrder - b.sortOrder)
    : card.heroImageUrl
      ? [{ url: card.heroImageUrl, sortOrder: 0 }]
      : [];

  const currentImage = images[imageIndex];
  const hasMultiple = images.length > 1;

  return (
    <Link
      href={`/listing/${card.id}`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`block rounded-xl overflow-hidden border transition-all bg-white ${
        isSelected
          ? 'border-sky-500 shadow-md'
          : 'border-[var(--mp-border)] hover:border-sky-300 hover:shadow-sm'
      }`}
    >
      <div className="flex">
        <div className="w-32 h-28 shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden group">
          {currentImage?.url && !imgError ? (
            <img
              src={currentImage.url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <span className="text-2xl mb-1">🏠</span>
              <span className="text-xs">Sin imagen</span>
            </div>
          )}

          {hasMultiple && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImgError(false);
                  setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  setImgError(false);
                  setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
                }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Imagen anterior"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImgError(false);
                  setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  setImgError(false);
                  setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Siguiente imagen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                  </div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, idx) => (
                  <div
                    key={`${card.id}-v-dot-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setImgError(false);
                      setImageIndex(idx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      e.stopPropagation();
                      setImgError(false);
                      setImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                      idx === imageIndex ? 'bg-white scale-125' : 'bg-white/60 hover:bg-white/80'
                    }`}
                    aria-label={`Ir a imagen ${idx + 1}`}
                  />
                ))}
              </div>

              <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/60 text-white px-2 py-1 rounded-full font-medium">
                📷 {imageIndex + 1}/{images.length}
              </span>
            </>
          )}

          {card.operationType && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded-full font-medium">
              {card.operationType === 'SALE' ? 'Venta' : 'Alq'}
            </span>
          )}
            </div>
        <div className="flex-1 p-3 min-w-0">
          <p className="text-sm font-bold text-sky-600">
            {formatListingPrice(card.price, card.currency)}
          </p>
          <p className="text-sm text-[var(--mp-foreground)] truncate font-medium mt-0.5">
            {card.title || 'Propiedad'}
          </p>
          <p className="text-xs text-[var(--mp-muted)] truncate mt-1">{card.locationText}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {card.bedrooms && (
              <span className="text-xs text-[var(--mp-muted)] bg-slate-100 px-1.5 py-0.5 rounded">
                {card.bedrooms} amb
              </span>
            )}
            {card.areaTotal && (
              <span className="text-xs text-[var(--mp-muted)] bg-slate-100 px-1.5 py-0.5 rounded">
                {card.areaTotal}m²
              </span>
            )}
          </div>
          <Link
            href={`/listing/${card.id}`}
            className="inline-block mt-2 text-xs text-sky-600 font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </Link>
  );
}
