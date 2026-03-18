'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ShareModal from '../../../components/ShareModal';
import ReverseMatchingMiniDashboard from '../../../components/ReverseMatchingMiniDashboard';
import InquiryModal from '../../../components/InquiryModal';
import PremiumGraceBanner from '../../../components/PremiumGraceBanner';

const API_BASE = '/api';
const GRACE_PERIOD = process.env.NEXT_PUBLIC_PREMIUM_GRACE_PERIOD === '1';

interface ListingDetailsExtra {
  amenities?: string[];
  services?: string[];
  aptoCredito?: boolean;
  orientation?: string;
  floor?: number;
  yearBuilt?: number;
}

interface ListingDetail {
  id: string;
  title: string | null;
  description: string | null;
  operationType: string | null;
  propertyType: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  lat: number | null;
  lng: number | null;
  addressText: string | null;
  locationText: string | null;
  heroImageUrl: string | null;
  source: string;
  details: ListingDetailsExtra | null;
  media: { url: string; sortOrder: number }[];
}

const INVALID_IDS = ['', 'undefined', 'null'];

export default function ListingDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? '';
  const invalidId = !id || INVALID_IDS.includes(id);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const handleImageError = useCallback((url: string) => {
    setFailedImages(prev => new Set(prev).add(url));
  }, []);
  const [matchSummary, setMatchSummary] = useState<{
    matchesCount: number;
    topSearchIds: string[];
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<{
    inFavorite: boolean;
    inLike: boolean;
    inLists: { id: string; name: string }[];
    lead: { status: string } | null;
  } | null>(null);
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareContact, setShareContact] = useState<{
    contactName?: string;
    contactOrg?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
  }>({});
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showGraceToast, setShowGraceToast] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setImageIndex(0);
  }, [id]);

  useEffect(() => {
    if (invalidId) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/listings/${id}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        setListing(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (invalidId || !listing) return;
    Promise.all([
      fetch(`${API_BASE}/me`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE}/listings/${id}/match-summary`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE}/listings/${id}/my-status`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE}/me/lists`, { credentials: 'include' }).then((r) =>
        r.ok
          ? r
              .json()
              .then((d: { lists?: { id: string; name: string; count: number }[] }) => d.lists ?? [])
          : []
      ),
    ]).then(([me, profile, summary, status, lists]) => {
      if (me?.role) setUserRole(me.role);
      const premiumUntil = me?.premiumUntil;
      setIsPremium(!!(premiumUntil && new Date(premiumUntil) > new Date()));
      const name =
        [profile?.profile?.firstName, profile?.profile?.lastName].filter(Boolean).join(' ') ||
        undefined;
      const org = profile?.organization?.name || profile?.organization?.commercialName || undefined;
      setShareContact({
        contactName: name || undefined,
        contactOrg: org || undefined,
        contactWhatsapp: profile?.profile?.whatsapp || undefined,
        contactEmail: me?.email || undefined,
      });
      if (summary?.matchesCount != null && summary.matchesCount > 0)
        setMatchSummary({
          matchesCount: summary.matchesCount,
          topSearchIds: summary.topSearchIds ?? [],
        });
      if (status) setMyStatus(status);
      if (Array.isArray(lists)) setCustomLists(lists);
    });
  }, [id, listing, invalidId]);

  async function handleToggleLike() {
    if (!myStatus) return;
    const inLike = myStatus.inLike;
    const url = inLike ? `${API_BASE}/me/saved/${id}?listType=LATER` : `${API_BASE}/saved`;
    const opts = inLike
      ? { method: 'DELETE', credentials: 'include' as RequestCredentials }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' as RequestCredentials,
          body: JSON.stringify({ listingId: id, listType: 'LATER' }),
        };
    const res = await fetch(url, opts);
    if (res.ok) setMyStatus((s) => (s ? { ...s, inLike: !inLike } : s));
  }

  async function handleToggleFavorite() {
    if (!myStatus) return;
    const inFav = myStatus.inFavorite;
    const url = inFav ? `${API_BASE}/me/saved/${id}?listType=FAVORITE` : `${API_BASE}/saved`;
    const opts = inFav
      ? { method: 'DELETE', credentials: 'include' as RequestCredentials }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' as RequestCredentials,
          body: JSON.stringify({ listingId: id, listType: 'FAVORITE' }),
        };
    const res = await fetch(url, opts);
    if (res.ok) setMyStatus((s) => (s ? { ...s, inFavorite: !inFav } : s));
  }

  async function handleAddToList(listId: string) {
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId: id }),
    });
    if (res.ok) {
      const list = customLists.find((l) => l.id === listId);
      setMyStatus((s) =>
        s && list ? { ...s, inLists: [...s.inLists, { id: listId, name: list.name }] } : s
      );
      setAddToListOpen(false);
    }
  }

  async function handleRemoveFromList(listId: string) {
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok)
      setMyStatus((s) => (s ? { ...s, inLists: s.inLists.filter((l) => l.id !== listId) } : s));
  }

  async function handleCreateListAndAdd() {
    const name = newListName.trim();
    if (!name) return;
    try {
      const createRes = await fetch(`${API_BASE}/me/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!createRes.ok) throw new Error('Error al crear');
      const list = (await createRes.json()) as { id: string };
      const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId: id }),
      });
      if (!addRes.ok) throw new Error('Error al agregar');
      setMyStatus((s) => (s ? { ...s, inLists: [...s.inLists, { id: list.id, name }] } : s));
      setCustomLists((prev) => [...prev, { id: list.id, name, count: 1 }]);
      setNewListName('');
      setAddToListOpen(false);
    } catch {
      /* ignore */
    }
  }

  if (invalidId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-600">Propiedad no encontrada</p>
        <Link href="/feed/list" className="mt-4 text-blue-600 hover:underline">
          Ver listado
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center">
        <div className="w-full max-w-lg animate-pulse space-y-4">
          <div className="aspect-video bg-slate-200 rounded-2xl" />
          <div className="h-6 bg-slate-200 rounded w-2/3" />
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-600">Propiedad no encontrada</p>
        <Link href="/feed/list" className="mt-4 text-blue-600 hover:underline">
          Ver listado
        </Link>
      </main>
    );
  }

  const images = listing.media?.length
    ? [...listing.media].sort((a, b) => a.sortOrder - b.sortOrder)
    : listing.heroImageUrl
      ? [{ url: listing.heroImageUrl, sortOrder: 0 }]
      : [];
  const currentImage = images[imageIndex];
  const hasMultiple = images.length > 1;

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        {toast && (
          <div className="mb-4 p-3 bg-amber-100 text-amber-800 rounded-lg text-sm border border-amber-200">
            {toast}
          </div>
        )}
        {showGraceToast && (
          <PremiumGraceBanner variant="toast" onDismiss={() => setShowGraceToast(false)} />
        )}
        <Link href="/feed" className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Volver al feed
        </Link>

        <div className="border rounded-2xl overflow-hidden bg-white shadow-lg">
          <div className="aspect-video bg-slate-100 relative group">
            {currentImage && !failedImages.has(currentImage.url) ? (
              <img
                src={currentImage.url}
                alt={listing.title ?? ''}
                className="w-full h-full object-cover transition-transform duration-300"
                loading="lazy"
                onError={() => handleImageError(currentImage.url)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-50 to-slate-200">
                <span className="text-6xl mb-2">🏠</span>
                <span className="text-sm">Sin imágenes disponibles</span>
              </div>
            )}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Anterior"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Siguiente"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImageIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${idx === imageIndex ? 'bg-white w-6' : 'bg-white/60 hover:bg-white/80'}`}
                      aria-label={`Ir a imagen ${idx + 1}`}
                    />
                  ))}
                </div>
                <span className="absolute top-3 right-3 text-xs bg-black/60 text-white px-3 py-1.5 rounded-full font-medium">
                  📷 {imageIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {hasMultiple && images.length > 2 && (
            <div className="flex gap-1 p-2 overflow-x-auto bg-slate-50">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${idx === imageIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  {!failedImages.has(img.url) ? (
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => handleImageError(img.url)}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs">🏠</div>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="p-4">
            {myStatus && (
              <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    myStatus.inLike
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title={myStatus.inLike ? 'En like' : 'Agregar a like'}
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    myStatus.inFavorite
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {myStatus.inFavorite ? '✓ En favoritos' : '+ Favoritos'}
                </button>
                {myStatus.inLists.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-medium"
                  >
                    📁 {l.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveFromList(l.id)}
                      className="text-emerald-600 hover:text-emerald-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setAddToListOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300"
                >
                  + Agregar a lista
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isPremium === false && !GRACE_PERIOD) {
                      setToast('Necesitás ser premium para compartir propiedades.');
                      setTimeout(() => setToast(null), 4000);
                      return;
                    }
                    const url =
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/listing/${id}`
                        : '';
                    setShareUrl(url);
                    setShareOpen(true);
                    if (GRACE_PERIOD && isPremium === false) {
                      setShowGraceToast(true);
                      setTimeout(() => setShowGraceToast(false), 8000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                >
                  📤 Compartir
                </button>
              </div>
            )}
            <ShareModal
              open={shareOpen}
              onClose={() => setShareOpen(false)}
              url={shareUrl}
              title={listing?.title ?? undefined}
              contactName={shareContact.contactName}
              contactOrg={shareContact.contactOrg}
              contactWhatsapp={shareContact.contactWhatsapp}
              contactEmail={shareContact.contactEmail}
            />
            {addToListOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[85vh] overflow-auto">
                  <h3 className="font-bold text-slate-900 mb-3">Agregar a lista</h3>
                  <div className="flex flex-col gap-2">
                    {!myStatus?.inFavorite && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleToggleLike();
                            setAddToListOpen(false);
                          }}
                          className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 text-left"
                        >
                          👍 Mis like
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleToggleFavorite();
                            setAddToListOpen(false);
                          }}
                          className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 text-left"
                        >
                          ★ Mis favoritos
                        </button>
                      </>
                    )}
                    {customLists.filter((l) => !myStatus?.inLists.some((i) => i.id === l.id))
                      .length > 0 && (
                      <div className="border-t border-slate-200 pt-3 mt-1">
                        <p className="text-xs text-slate-700 font-medium mb-2">
                          O guardar en lista existente
                        </p>
                        <div className="flex flex-col gap-1 max-h-40 overflow-auto">
                          {customLists
                            .filter((l) => !myStatus?.inLists.some((i) => i.id === l.id))
                            .map((l) => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => handleAddToList(l.id)}
                                className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 text-left"
                              >
                                📁 {l.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 mt-1">
                      <p className="text-xs text-slate-800 font-semibold mb-2">
                        O crear nueva lista
                      </p>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Ej: galpones en Rosario"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateListAndAdd}
                        className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200"
                      >
                        Crear y agregar
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddToListOpen(false);
                      setNewListName('');
                    }}
                    className="mt-4 w-full py-2 text-slate-700 text-sm hover:text-slate-900 font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
            <ReverseMatchingMiniDashboard
              matchesCount={matchSummary?.matchesCount ?? 0}
              topSearchIds={matchSummary?.topSearchIds}
              adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002'}
              visible={
                (userRole === 'AGENT' || userRole === 'ADMIN') &&
                (matchSummary?.matchesCount ?? 0) > 0
              }
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {listing.operationType && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {listing.operationType === 'SALE' ? 'Venta' : 'Alquiler'}
                </span>
              )}
              {listing.propertyType && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                  {listing.propertyType}
                </span>
              )}
              {(listing.details as ListingDetailsExtra | null)?.aptoCredito && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                  Apto crédito
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold">{listing.title ?? 'Sin título'}</h1>
            <p className="text-lg text-gray-700 mt-1">
              {listing.price != null
                ? `${listing.currency ?? 'USD'} ${listing.price.toLocaleString()}`
                : 'Consultar'}
            </p>
            {listing.addressText && (
              <p className="text-sm text-gray-600 mt-1">📍 {listing.addressText}</p>
            )}
            {listing.locationText && (
              <p className="text-sm text-gray-500 mt-0.5">{listing.locationText}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
              {listing.bedrooms != null && <span>{listing.bedrooms} amb</span>}
              {listing.bathrooms != null && <span>{listing.bathrooms} baños</span>}
              {listing.areaTotal != null && <span>{listing.areaTotal} m² total</span>}
              {listing.areaCovered != null && <span>{listing.areaCovered} m² cubiertos</span>}
            </div>
            {listing.description && (
              <section className="mt-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-1">Descripción</h2>
                <p className="text-gray-700 text-sm leading-relaxed">{listing.description}</p>
              </section>
            )}
            {listing.details && (listing.details as ListingDetailsExtra).amenities?.length ? (
              <section className="mt-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {((listing.details as ListingDetailsExtra).amenities ?? []).map((a) => (
                    <span key={a} className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            {listing.details && (listing.details as ListingDetailsExtra).services?.length ? (
              <section className="mt-3">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Servicios</h2>
                <div className="flex flex-wrap gap-2">
                  {((listing.details as ListingDetailsExtra).services ?? []).map((s) => (
                    <span key={s} className="px-2 py-1 bg-blue-50 rounded text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            {listing.lat != null && listing.lng != null && (
              <section className="mt-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Ubicación</h2>
                <div className="h-48 sm:h-56 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  <iframe
                    title="Mapa de ubicación"
                    width="100%"
                    height="100%"
                    className="border-0 w-full min-h-[12rem]"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                      `${listing.lng - 0.02},${listing.lat - 0.02},${listing.lng + 0.02},${listing.lat + 0.02}`
                    )}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}#map=16/${listing.lat}/${listing.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Ver en OpenStreetMap
                  </a>
                </p>
              </section>
            )}
            <div className="mt-4 flex gap-2 items-center">
              {myStatus?.lead ? (
                <>
                  <span
                    className={`flex-1 py-2.5 rounded-xl font-medium text-center ${
                      myStatus.lead.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    ✓{' '}
                    {myStatus.lead.status === 'ACTIVE' ? 'Esperando respuesta' : 'Consulta enviada'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInquiryOpen(true)}
                    className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200"
                    title="Enviar otra consulta"
                  >
                    ✉️
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Quiero que me contacten
                </button>
              )}
            </div>
            {inquiryOpen && (
              <InquiryModal
                open={inquiryOpen}
                onClose={() => setInquiryOpen(false)}
                listingId={id}
                source="DETAIL"
                onSent={() => setMyStatus((s) => (s ? { ...s, lead: { status: 'PENDING' } } : s))}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
