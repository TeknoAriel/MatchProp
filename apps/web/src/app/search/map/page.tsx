'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

const API_BASE = '/api';

type MapListing = {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  price: number | null;
  locationText: string | null;
};

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const DEFAULT_LAT = -34.6037;
const DEFAULT_LNG = -58.3816;
const BBOX_PADDING = 0.08;

/** Mapa cargado solo en cliente para evitar "Map container is already initialized" */
const MapView = dynamic(() => import('../../../components/SearchMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] bg-slate-200 animate-pulse flex items-center justify-center text-slate-500">
      Cargando mapa...
    </div>
  ),
});

export default function SearchMapPage() {
  const router = useRouter();
  const [items, setItems] = useState<MapListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
  });
  const fetchMapItems = useCallback(
    async (b: Bounds | null) => {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (b) {
        params.set('minLat', String(b.minLat));
        params.set('maxLat', String(b.maxLat));
        params.set('minLng', String(b.minLng));
        params.set('maxLng', String(b.maxLng));
      }
      const res = await fetch(`${API_BASE}/feed/map?${params}`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
      if (!res.ok) throw new Error('Error al cargar ubicaciones');
      return res.json() as Promise<{ items?: MapListing[] }>;
    },
    [router]
  );

  useEffect(() => {
    fetchMapItems(null)
      .then((data) => {
        if (data?.items?.length) {
          setItems(data.items);
          const first = data.items[0]!;
          setCenter({ lat: first.lat, lng: first.lng });
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        setLoading(false);
      });
  }, [fetchMapItems]);

  const handleBoundsChange = useCallback((b: Bounds) => {
    fetch(
      `${API_BASE}/feed/map?limit=200&minLat=${b.minLat}&maxLat=${b.maxLat}&minLng=${b.minLng}&maxLng=${b.maxLng}`,
      { credentials: 'include' }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: MapListing[] } | null) => {
        if (data?.items) setItems(data.items);
      })
      .catch(() => {});
  }, []);

  const bounds: [[number, number], [number, number]] = useMemo(() => {
    if (items.length > 0) {
      const lats = items.map((p) => p.lat);
      const lngs = items.map((p) => p.lng);
      const minLat = Math.min(...lats) - BBOX_PADDING;
      const maxLat = Math.max(...lats) + BBOX_PADDING;
      const minLng = Math.min(...lngs) - BBOX_PADDING;
      const maxLng = Math.max(...lngs) + BBOX_PADDING;
      return [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }
    return [
      [center.lat - BBOX_PADDING, center.lng - BBOX_PADDING],
      [center.lat + BBOX_PADDING, center.lng + BBOX_PADDING],
    ];
  }, [items, center.lat, center.lng]);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="p-4 border-b bg-white flex flex-wrap items-center gap-2">
        <Link href="/search" className="text-sm text-blue-600 hover:underline">
          ← Búsqueda por filtros
        </Link>
        <Link href="/assistant" className="text-sm text-blue-600 hover:underline">
          Asistente
        </Link>
        <Link href="/feed/list" className="text-sm text-blue-600 hover:underline">
          Ver listado
        </Link>
        <h1 className="text-xl font-bold text-slate-900 w-full mt-2">Buscar por mapa</h1>
        <p className="text-sm text-slate-600 w-full">
          Cada propiedad tiene su propia ubicación (lat/lng distinta). El mapa muestra todos los
          puntos con coordenadas; en el listado podés abrir cada ficha o usar &quot;Ver en
          mapa&quot; para ver el detalle en otra pestaña.
        </p>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <div className="p-4 text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          <div className="flex-1 min-h-[300px] bg-slate-100 relative">
            <MapView
              items={items}
              center={[center.lat, center.lng]}
              bounds={bounds}
              onBoundsChange={handleBoundsChange}
            />
          </div>
          <div className="p-4 bg-white border-t max-h-[40vh] overflow-y-auto">
            <h2 className="font-semibold text-slate-900 mb-2">
              Propiedades con ubicación ({items.length})
            </h2>
            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="text-slate-500 text-sm">
                  No hay propiedades con coordenadas en tu búsqueda.
                </li>
              ) : (
                items.slice(0, 50).map((item) => (
                  <li
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50"
                  >
                    <Link href={`/listing/${item.id}`} className="block text-slate-800">
                      <span className="font-medium truncate block">
                        {item.title || 'Sin título'}
                      </span>
                      {item.locationText && (
                        <span className="text-xs text-slate-500">{item.locationText}</span>
                      )}
                      {item.price != null && (
                        <span className="text-sm text-green-700 ml-1">
                          ${item.price.toLocaleString()}
                        </span>
                      )}
                    </Link>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Ver en mapa
                    </a>
                  </li>
                ))
              )}
            </ul>
            {items.length > 50 && (
              <p className="text-sm text-slate-500 mt-2">
                Mostrando 50 de {items.length}. Usá la búsqueda por filtros para afinar.
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
