'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';
import 'leaflet/dist/leaflet.css';

const API_BASE = '/api';

type MapListingCard = ListingCard & { lat: number; lng: number };
type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const DEFAULT_CENTER = { lat: -32.9468, lng: -60.6393 }; // Rosario

function normalizeCard(raw: unknown): MapListingCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  const lat = typeof c.lat === 'number' ? c.lat : null;
  const lng = typeof c.lng === 'number' ? c.lng : null;
  if (!id || lat == null || lng == null) return null;
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
    heroImageUrl: typeof c.heroImageUrl === 'string' && c.heroImageUrl ? c.heroImageUrl : null,
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
          if (normalized.length > 0) {
            setCenter({ lat: normalized[0].lat, lng: normalized[0].lng });
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
              showList 
                ? 'bg-sky-500 text-white' 
                : 'bg-[var(--mp-bg)] text-[var(--mp-muted)]'
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
              {selectedItem.heroImageUrl && (
                <div className="w-24 h-24 shrink-0">
                  <img
                    src={selectedItem.heroImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 p-3 min-w-0">
                <h3 className="font-medium text-sm truncate text-[var(--mp-foreground)]">
                  {selectedItem.title || 'Propiedad'}
                </h3>
                <p className="text-sm font-semibold text-sky-600">
                  {selectedItem.currency || 'USD'} {selectedItem.price?.toLocaleString() || 'Consultar'}
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
              <button
                onClick={() => setSelectedId(null)}
                className="p-2 text-[var(--mp-muted)]"
              >
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
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-48 h-full rounded-xl overflow-hidden border transition-all text-left ${
        isSelected
          ? 'border-sky-500 shadow-lg scale-[1.02]'
          : 'border-[var(--mp-border)] hover:border-sky-300'
      }`}
    >
      <div className="h-24 bg-gray-200">
        {card.heroImageUrl ? (
          <img src={card.heroImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
            🏠
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-sm font-semibold text-sky-600 truncate">
          {card.currency || 'USD'} {card.price?.toLocaleString() || 'Consultar'}
        </p>
        <p className="text-xs text-[var(--mp-foreground)] truncate">{card.title || 'Propiedad'}</p>
        <p className="text-xs text-[var(--mp-muted)] truncate">{card.locationText}</p>
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
  return (
    <Link
      href={`/listing/${card.id}`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`block rounded-xl overflow-hidden border transition-all ${
        isSelected
          ? 'border-sky-500 shadow-md'
          : 'border-[var(--mp-border)] hover:border-sky-300'
      }`}
    >
      <div className="flex">
        <div className="w-28 h-24 shrink-0 bg-gray-200">
          {card.heroImageUrl ? (
            <img src={card.heroImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
              🏠
            </div>
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <p className="text-sm font-semibold text-sky-600">
            {card.currency || 'USD'} {card.price?.toLocaleString() || 'Consultar'}
          </p>
          <p className="text-sm text-[var(--mp-foreground)] truncate font-medium">
            {card.title || 'Propiedad'}
          </p>
          <p className="text-xs text-[var(--mp-muted)] truncate mt-1">{card.locationText}</p>
          {card.bedrooms && (
            <p className="text-xs text-[var(--mp-muted)] mt-1">
              {card.bedrooms} amb · {card.areaTotal ? `${card.areaTotal}m²` : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
