'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/** Key único por instancia para evitar "Map container is already initialized" al remontar */
function useMapInstanceKey(mounted: boolean) {
  const keyRef = useRef<string | null>(null);
  if (mounted && !keyRef.current) {
    keyRef.current = `map-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return keyRef.current;
}

type MapListing = {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  price: number | null;
  locationText: string | null;
};

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const DEBOUNCE_MS = 400;

function MapBoundsReporter({ onBoundsChange }: { onBoundsChange: (b: Bounds) => void }) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const map = useMapEvents({
    moveend: () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        const b = map.getBounds();
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        onBoundsChange({
          minLat: sw.lat,
          maxLat: ne.lat,
          minLng: sw.lng,
          maxLng: ne.lng,
        });
      }, DEBOUNCE_MS);
    },
  });
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );
  return null;
}

type SearchMapViewProps = {
  items: MapListing[];
  center: [number, number];
  bounds: [[number, number], [number, number]];
  onBoundsChange: (b: Bounds) => void;
};

export default function SearchMapView({
  items,
  center,
  bounds,
  onBoundsChange,
}: SearchMapViewProps) {
  const [mounted, setMounted] = useState(false);
  const mapKey = useMapInstanceKey(mounted);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!mounted || !mapKey) {
    return (
      <div className="absolute inset-0 min-h-[300px] w-full bg-slate-200 flex items-center justify-center text-slate-500">
        Cargando mapa...
      </div>
    );
  }

  return (
    <MapContainer
      key={mapKey}
      center={center}
      bounds={bounds}
      scrollWheelZoom
      className="absolute inset-0 min-h-[300px] w-full"
    >
      <MapBoundsReporter onBoundsChange={onBoundsChange} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => (
        <CircleMarker
          key={item.id}
          center={[item.lat, item.lng]}
          radius={6}
          pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.9 }}
        >
          <Tooltip direction="top">
            <div className="text-xs">
              <div className="font-semibold">{item.title || 'Sin título'}</div>
              {item.locationText && <div>{item.locationText}</div>}
              {item.price != null && <div>${item.price.toLocaleString()}</div>}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
