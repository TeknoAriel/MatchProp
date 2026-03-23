'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatListingPrice } from '../../../lib/format-price';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

type ShareListing = {
  id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  locationText: string | null;
};

function ListasSharePageContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ShareListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = searchParams?.get('ids') ?? '';
    if (!ids.trim()) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/listings/share?ids=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ShareListing[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 bg-slate-50">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {PRODUCT_NAME} — Propiedades compartidas
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Lista temporal con enlaces a cada propiedad. Al agregar o quitar ítems, el enlace cambia.
        </p>
        {items.length === 0 ? (
          <p className="text-slate-500">No hay propiedades en esta lista.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <Link
                  href={`/listing/${item.id}`}
                  className="block text-slate-800 hover:text-blue-600"
                >
                  <span className="font-medium block truncate">{item.title || 'Sin título'}</span>
                  {item.price != null && (
                    <span className="text-sm text-emerald-700">
                      {formatListingPrice(item.price, item.currency)}
                    </span>
                  )}
                  {item.locationText && (
                    <span className="text-xs text-slate-500 block mt-1 truncate">
                      {item.locationText}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/login" className="inline-block mt-6 text-sm text-blue-600 hover:underline">
          Ir a {PRODUCT_NAME}
        </Link>
      </div>
    </main>
  );
}

export default function ListasSharePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4 flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <ListasSharePageContent />
    </Suspense>
  );
}
