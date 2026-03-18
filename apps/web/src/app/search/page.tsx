'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ListingCard, SearchFilters } from '@matchprop/shared';
import { filtersToHumanSummary } from '../../lib/filters-summary';
import InquiryModal from '../../components/InquiryModal';

const API_BASE = '/api';
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'LAND', 'OFFICE', 'OTHER'] as const;
const OPERATIONS = ['SALE', 'RENT'] as const;
const CURRENCIES = ['USD', 'ARS'] as const;
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio menor a mayor' },
  { value: 'price_desc', label: 'Precio mayor a menor' },
  { value: 'area_desc', label: 'Superficie mayor' },
] as const;
const AMENITIES = [
  { id: 'SUM', label: 'SUM' },
  { id: 'quincho', label: 'Quincho' },
  { id: 'parrilla', label: 'Parrilla' },
  { id: 'cocheras', label: 'Cocheras' },
  { id: 'pileta', label: 'Pileta' },
  { id: 'gimnasio', label: 'Gimnasio' },
] as const;

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--mp-border)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 text-left font-medium text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]/50 rounded-lg px-2 -mx-2 transition-colors"
      >
        {title}
        <span className="text-[var(--mp-muted)] text-sm">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

function normalizeCard(raw: unknown): ListingCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  if (!id) return null;
  return {
    id,
    title: typeof c.title === 'string' ? c.title : null,
    price: typeof c.price === 'number' ? c.price : null,
    currency: typeof c.currency === 'string' ? c.currency : null,
    bedrooms: typeof c.bedrooms === 'number' ? c.bedrooms : null,
    bathrooms: typeof c.bathrooms === 'number' ? c.bathrooms : null,
    areaTotal: typeof c.areaTotal === 'number' ? c.areaTotal : null,
    locationText: typeof c.locationText === 'string' ? c.locationText : null,
    heroImageUrl: typeof c.heroImageUrl === 'string' && c.heroImageUrl ? c.heroImageUrl : null,
    publisherRef: typeof c.publisherRef === 'string' ? c.publisherRef : null,
    source: typeof c.source === 'string' ? c.source : 'API_PARTNER_1',
    operationType: typeof c.operationType === 'string' ? c.operationType : null,
  };
}

export default function ManualSearchPage() {
  const router = useRouter();
  const [operation, setOperation] = useState<'SALE' | 'RENT'>('SALE');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [locationText, setLocationText] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
  const [bedroomsMin, setBedroomsMin] = useState('');
  const [bedroomsMax] = useState('');
  const [bathroomsMin, setBathroomsMin] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');
  const [areaCoveredMin, setAreaCoveredMin] = useState('');
  const [titleContains, setTitleContains] = useState('');
  const [descriptionContains, setDescriptionContains] = useState('');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [source, setSource] = useState('');
  const [aptoCredito, setAptoCredito] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photosCountMin, setPhotosCountMin] = useState('');
  const [listingAgeDays, setListingAgeDays] = useState('');
  const [openSection, setOpenSection] = useState<string>('operacion');
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [listingsStatus, setListingsStatus] = useState<
    Record<
      string,
      {
        inFavorite: boolean;
        inLike: boolean;
        inLists: { id: string; name: string }[];
        lead: { status: string } | null;
      }
    >
  >({});
  const [addToListCard, setAddToListCard] = useState<ListingCard | null>(null);
  const [newListName, setNewListName] = useState('');
  const [customLists, setCustomLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [inquiryListingId, setInquiryListingId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.filter((c) => c.id).map((c) => c.id);
    if (ids.length === 0) {
      setListingsStatus({});
      return;
    }
    fetch(`${API_BASE}/listings/my-status-bulk?ids=${ids.join(',')}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then(
        (data: {
          items?: Record<
            string,
            {
              inFavorite: boolean;
              inLike: boolean;
              inLists: { id: string; name: string }[];
              lead: { status: string } | null;
            }
          >;
        }) => setListingsStatus(data.items ?? {})
      )
      .catch(() => setListingsStatus({}));
  }, [items]);

  function handleConsultaSent(listingId: string) {
    setListingsStatus((prev) => ({
      ...prev,
      [listingId]: {
        ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
        lead: { status: 'PENDING' },
      },
    }));
  }

  async function handleToggleLike(listingId: string) {
    const s = listingsStatus[listingId];
    const inLike = s?.inLike ?? false;
    try {
      if (inLike) {
        const del = await fetch(`${API_BASE}/me/saved/${listingId}?listType=LATER`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (del.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inLike: false,
            },
          }));
        }
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId, listType: 'LATER' }),
        });
        if (res.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inLike: true,
            },
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function handleToggleFavorite(listingId: string) {
    const s = listingsStatus[listingId];
    const inFav = s?.inFavorite ?? false;
    try {
      if (inFav) {
        const del = await fetch(`${API_BASE}/me/saved/${listingId}?listType=FAVORITE`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (del.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: false,
            },
          }));
        }
      } else {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ listingId, listType: 'FAVORITE' }),
        });
        if (res.ok) {
          setListingsStatus((prev) => ({
            ...prev,
            [listingId]: {
              ...(prev[listingId] ?? { inFavorite: false, inLike: false, inLists: [], lead: null }),
              inFavorite: true,
            },
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }

  function handleAgregarALista(card: ListingCard) {
    setAddToListCard(card);
    fetch(`${API_BASE}/me/lists`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data: { lists?: { id: string; name: string; count: number }[] }) =>
        setCustomLists(data?.lists ?? [])
      )
      .catch(() => setCustomLists([]));
  }

  async function handleSaveToList(listingId: string, listType: 'FAVORITE' | 'LATER') {
    const res = await fetch(`${API_BASE}/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId, listType }),
    });
    if (res.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [listingId]: {
          inFavorite: listType === 'FAVORITE' ? true : (prev[listingId]?.inFavorite ?? false),
          inLike: listType === 'LATER' ? true : (prev[listingId]?.inLike ?? false),
          inLists: prev[listingId]?.inLists ?? [],
          lead: prev[listingId]?.lead ?? null,
        },
      }));
      setAddToListCard(null);
    }
  }

  async function handleAddToCustomList(listId: string) {
    if (!addToListCard) return;
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId: addToListCard.id }),
    });
    if (res.ok) {
      const list = customLists.find((l) => l.id === listId);
      if (list) {
        setListingsStatus((prev) => ({
          ...prev,
          [addToListCard.id]: {
            inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
            inLike: prev[addToListCard.id]?.inLike ?? false,
            inLists: [...(prev[addToListCard.id]?.inLists ?? []), { id: list.id, name: list.name }],
            lead: prev[addToListCard.id]?.lead ?? null,
          },
        }));
      }
      setAddToListCard(null);
    }
  }

  async function handleNuevaListaSubmit() {
    if (!addToListCard) return;
    const name = newListName.trim();
    if (!name) return;
    const createRes = await fetch(`${API_BASE}/me/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!createRes.ok) return;
    const list = (await createRes.json()) as { id: string };
    const addRes = await fetch(`${API_BASE}/me/lists/${list.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId: addToListCard.id }),
    });
    if (addRes.ok) {
      setListingsStatus((prev) => ({
        ...prev,
        [addToListCard.id]: {
          inFavorite: prev[addToListCard.id]?.inFavorite ?? false,
          inLike: prev[addToListCard.id]?.inLike ?? false,
          inLists: [...(prev[addToListCard.id]?.inLists ?? []), { id: list.id, name }],
          lead: prev[addToListCard.id]?.lead ?? null,
        },
      }));
      setCustomLists((prev) => [...prev, { id: list.id, name, count: 1 }]);
      setNewListName('');
      setAddToListCard(null);
    }
  }

  async function handleRemoveFromList(listId: string, listingId: string) {
    const res = await fetch(`${API_BASE}/me/lists/${listId}/items/${listingId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setListingsStatus((prev) => {
        const cur = prev[listingId];
        if (!cur) return prev;
        return {
          ...prev,
          [listingId]: { ...cur, inLists: cur.inLists.filter((l) => l.id !== listId) },
        };
      });
    }
  }

  const filters: SearchFilters & Record<string, unknown> = {
    operationType: operation,
    propertyType: propertyTypes.length ? propertyTypes : undefined,
    locationText: locationText.trim() || undefined,
    priceMin: priceMin ? parseInt(priceMin, 10) : undefined,
    priceMax: priceMax ? parseInt(priceMax, 10) : undefined,
    currency,
    bedroomsMin: bedroomsMin ? parseInt(bedroomsMin, 10) : undefined,
    bedroomsMax: bedroomsMax ? parseInt(bedroomsMax, 10) : undefined,
    bathroomsMin: bathroomsMin ? parseInt(bathroomsMin, 10) : undefined,
    areaMin: areaMin ? parseInt(areaMin, 10) : undefined,
    areaMax: areaMax ? parseInt(areaMax, 10) : undefined,
    areaCoveredMin: areaCoveredMin ? parseInt(areaCoveredMin, 10) : undefined,
    titleContains: titleContains.trim() || undefined,
    descriptionContains: descriptionContains.trim() || undefined,
    sortBy:
      sortBy !== 'date_desc' ? (sortBy as 'price_asc' | 'price_desc' | 'area_desc') : undefined,
    source: source.trim() || undefined,
    aptoCredito: aptoCredito || undefined,
    amenities: amenities.length ? amenities : undefined,
    photosCountMin: photosCountMin ? parseInt(photosCountMin, 10) : undefined,
    listingAgeDays: listingAgeDays ? parseInt(listingAgeDays, 10) : undefined,
  };

  const fetchResults = useCallback(
    async (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('includeTotal', '1');
      if (filters.operationType) params.set('operationType', filters.operationType);
      if (filters.propertyType?.length) params.set('propertyTypes', filters.propertyType.join(','));
      if (filters.locationText) params.set('locationText', filters.locationText);
      if (filters.priceMin != null) params.set('priceMin', String(filters.priceMin));
      if (filters.priceMax != null) params.set('priceMax', String(filters.priceMax));
      if (filters.currency) params.set('currency', filters.currency);
      if (filters.bedroomsMin != null) params.set('bedroomsMin', String(filters.bedroomsMin));
      if (filters.bedroomsMax != null) params.set('bedroomsMax', String(filters.bedroomsMax));
      if (filters.bathroomsMin != null) params.set('bathroomsMin', String(filters.bathroomsMin));
      if (filters.areaMin != null) params.set('areaMin', String(filters.areaMin));
      if (filters.areaMax != null) params.set('areaMax', String(filters.areaMax));
      if (filters.areaCoveredMin != null)
        params.set('areaCoveredMin', String(filters.areaCoveredMin));
      if (filters.titleContains) params.set('titleContains', filters.titleContains);
      if (filters.descriptionContains)
        params.set('descriptionContains', filters.descriptionContains);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.source) params.set('source', filters.source);
      if (filters.aptoCredito) params.set('aptoCredito', '1');
      if (filters.amenities?.length) params.set('amenities', filters.amenities.join(','));
      if (filters.photosCountMin != null)
        params.set('photosCountMin', String(filters.photosCountMin));
      if (filters.listingAgeDays != null)
        params.set('listingAgeDays', String(filters.listingAgeDays));
      if (cursor) params.set('cursor', cursor);

      params.set('feed', 'all');
      const res = await fetch(`${API_BASE}/feed?${params}`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/login');
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    [filters, router]
  );

  async function handleVerResultados() {
    setError(null);
    setLoadingPreview(true);
    setHasSearched(true);
    try {
      const data = await fetchResults(null);
      if (data) {
        const arr = Array.isArray(data.items) ? data.items : [];
        setItems(
          arr.map(normalizeCard).filter((c: ListingCard | null): c is ListingCard => c !== null)
        );
      } else {
        setItems([]);
        setError('Error al cargar resultados');
      }
    } catch {
      setItems([]);
      setError('Error de conexión');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleVerCatalogoCompleto() {
    setError(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`${API_BASE}/feed?limit=20&includeTotal=1&feed=all`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = res.ok ? await res.json() : null;
      if (data?.items?.length) {
        setItems(
          data.items
            .map(normalizeCard)
            .filter((c: ListingCard | null): c is ListingCard => c !== null)
        );
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGuardar() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: filtersToHumanSummary(filters).slice(0, 80) || 'Búsqueda manual',
          filters: {
            ...filters,
            propertyType: filters.propertyType?.length ? filters.propertyType : undefined,
          },
        }),
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? 'Error al guardar');
        return;
      }
      const { id } = await res.json();
      setSavedId(id);
      await fetch(`${API_BASE}/me/active-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ searchId: id }),
      });
      setToast('Búsqueda guardada');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivarAlertas() {
    if (!savedId) return;
    try {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: savedId, type: 'NEW_LISTING' }),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        setToast('Alertas activadas');
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast('Error al activar alertas');
      setTimeout(() => setToast(null), 2000);
    }
  }

  function togglePropertyType(t: string) {
    setPropertyTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const activeChips = [
    operation === 'SALE' ? 'Compra' : 'Alquiler',
    ...propertyTypes,
    locationText.trim() || null,
    priceMin ? `Min ${priceMin}` : null,
    priceMax ? `Max ${priceMax}` : null,
    bedroomsMin ? `${bedroomsMin}+ dorm` : null,
    areaMin ? `${areaMin}+ m²` : null,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-[var(--mp-foreground)] mb-2">
            Búsqueda por filtros
          </h1>
          <p className="text-sm text-[var(--mp-muted)]">
            <Link href="/assistant" className="hover:text-[var(--mp-foreground)]">
              Por texto
            </Link>
            {' · '}
            <Link href="/search/map" className="hover:text-[var(--mp-foreground)]">
              Por mapa
            </Link>
            {' · '}
            <Link href="/searches" className="hover:text-[var(--mp-foreground)]">
              Mis búsquedas
            </Link>
          </p>
        </header>

        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--mp-card)] shadow-sm border border-[var(--mp-border)] space-y-2">
          <AccordionSection
            title="Operación y tipo"
            open={openSection === 'operacion'}
            onToggle={() => setOpenSection(openSection === 'operacion' ? '' : 'operacion')}
          >
            <div>
              <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-1.5">
                Operación
              </label>
              <div className="flex gap-2">
                {OPERATIONS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperation(op)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      operation === op
                        ? 'btn-accent'
                        : 'bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80'
                    }`}
                  >
                    {op === 'SALE' ? 'Compra' : 'Alquiler'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--mp-foreground)] mb-1.5">
                Tipo
              </label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => togglePropertyType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      propertyTypes.includes(t)
                        ? 'btn-accent'
                        : 'bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80'
                    }`}
                  >
                    {t === 'APARTMENT'
                      ? 'Depto'
                      : t === 'HOUSE'
                        ? 'Casa'
                        : t === 'LAND'
                          ? 'Terreno'
                          : t === 'OFFICE'
                            ? 'Oficina'
                            : 'Otro'}
                  </button>
                ))}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Ubicación"
            open={openSection === 'ubicacion'}
            onToggle={() => setOpenSection(openSection === 'ubicacion' ? '' : 'ubicacion')}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad o zona</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Ej: Rosario, Palermo"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Precio"
            open={openSection === 'precio'}
            onToggle={() => setOpenSection(openSection === 'precio' ? '' : 'precio')}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mín</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Ej: 50000"
                  className="w-full p-2 border rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Ej: 200000"
                  className="w-full p-2 border rounded-lg border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'USD' | 'ARS')}
                className="w-full p-2 border rounded-lg border-gray-300"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Ambientes"
            open={openSection === 'ambientes'}
            onToggle={() => setOpenSection(openSection === 'ambientes' ? '' : 'ambientes')}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ambientes desde (dormitorios)
              </label>
              <input
                type="number"
                min={0}
                value={bedroomsMin}
                onChange={(e) => setBedroomsMin(e.target.value)}
                placeholder="Ej: 2"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baños (mínimo)</label>
              <input
                type="number"
                min={0}
                value={bathroomsMin}
                onChange={(e) => setBathroomsMin(e.target.value)}
                placeholder="Ej: 1"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Amenidades"
            open={openSection === 'amenidades'}
            onToggle={() => setOpenSection(openSection === 'amenidades' ? '' : 'amenidades')}
          >
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setAmenities((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs ${
                    amenities.includes(a.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Más opciones"
            open={openSection === 'opciones'}
            onToggle={() => setOpenSection(openSection === 'opciones' ? '' : 'opciones')}
          >
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aptoCredito}
                  onChange={(e) => setAptoCredito(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Apto crédito</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mín fotos por listing
              </label>
              <input
                type="number"
                min={0}
                value={photosCountMin}
                onChange={(e) => setPhotosCountMin(e.target.value)}
                placeholder="0"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publicado en últimos (días)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={listingAgeDays}
                onChange={(e) => setListingAgeDays(e.target.value)}
                placeholder="Ej: 7, 30"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Superficie (m²)"
            open={openSection === 'superficie'}
            onToggle={() => setOpenSection(openSection === 'superficie' ? '' : 'superficie')}
          >
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mín total</label>
                <input
                  type="number"
                  min={0}
                  value={areaMin}
                  onChange={(e) => setAreaMin(e.target.value)}
                  placeholder="0"
                  className="w-full p-2 border rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx total</label>
                <input
                  type="number"
                  min={0}
                  value={areaMax}
                  onChange={(e) => setAreaMax(e.target.value)}
                  placeholder="—"
                  className="w-full p-2 border rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mín cubiertos
                </label>
                <input
                  type="number"
                  min={0}
                  value={areaCoveredMin}
                  onChange={(e) => setAreaCoveredMin(e.target.value)}
                  placeholder="0"
                  className="w-full p-2 border rounded-lg border-gray-300"
                />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Texto y orden"
            open={openSection === 'texto'}
            onToggle={() => setOpenSection(openSection === 'texto' ? '' : 'texto')}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título contiene
              </label>
              <input
                type="text"
                value={titleContains}
                onChange={(e) => setTitleContains(e.target.value)}
                placeholder="Ej: luminoso"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción contiene
              </label>
              <input
                type="text"
                value={descriptionContains}
                onChange={(e) => setDescriptionContains(e.target.value)}
                placeholder="Ej: pileta"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border rounded-lg border-gray-300"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuente (opcional)
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ej: API_PARTNER_1"
                className="w-full p-2 border rounded-lg border-gray-300"
              />
            </div>
          </AccordionSection>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-4 border-t border-[var(--mp-border)]">
            <button
              onClick={handleVerResultados}
              disabled={loadingPreview}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold btn-accent shadow-sm hover:shadow disabled:opacity-50 transition-all order-1"
            >
              {loadingPreview ? 'Cargando...' : 'Ver resultados'}
            </button>
            <div className="flex flex-wrap gap-2 order-2">
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:bg-slate-200/80 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={handleActivarAlertas}
                disabled={!savedId}
                title={!savedId ? 'Guardá la búsqueda primero' : undefined}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50 transition-colors"
              >
                Activar alertas
              </button>
            </div>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Filtros:</span>
            {activeChips.map((c) => (
              <span key={c} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {c}
              </span>
            ))}
          </div>
        )}

        {toast && <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm">{toast}</div>}
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            {error}
          </div>
        )}

        {items.length > 0 && (
          <>
            <h2 className="text-lg font-bold">Resultados</h2>
            <div className="space-y-4">
              {items.map((card) => {
                const s = listingsStatus[card.id];
                const inLists = s?.inLists ?? [];
                const hasLead = !!s?.lead;
                const leadStatus = s?.lead?.status;
                const inLike = s?.inLike ?? false;
                const inFavorite = s?.inFavorite ?? false;
                return (
                  <div
                    key={card.id}
                    className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200"
                  >
                    {inLists.length > 0 && (
                      <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-slate-50/80">
                        {inLists.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium"
                          >
                            📁 {l.name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveFromList(l.id, card.id);
                              }}
                              className="ml-0.5 hover:bg-emerald-200 rounded p-0.5"
                              aria-label={`Quitar de ${l.name}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/listing/${card.id}`}
                      className="block hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                        {card.heroImageUrl ? (
                          <img
                            src={card.heroImageUrl}
                            alt={card.title ?? ''}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <span className="text-3xl mb-1">🏠</span>
                            <span className="text-xs">Sin imagen</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold truncate">{card.title ?? 'Sin título'}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-sm font-medium">
                            {card.price != null
                              ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}`
                              : 'Consultar'}
                          </span>
                          {card.bedrooms != null && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {card.bedrooms} amb
                            </span>
                          )}
                          {card.locationText && (
                            <span className="text-xs text-gray-500 truncate">
                              {card.locationText}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="px-3 pb-3 flex gap-2 items-center flex-wrap border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(card.id)}
                        className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                          inLike
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={inLike ? 'En like' : 'Agregar a like'}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(card.id)}
                        className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg ${
                          inFavorite
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                        title={inFavorite ? 'En favoritos' : 'Agregar a favoritos'}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAgregarALista(card)}
                        className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        + Lista
                      </button>
                      {hasLead ? (
                        <div className="flex-1 flex items-center gap-1">
                          <span
                            className={`flex-1 py-2 text-center text-sm rounded-xl font-medium ${
                              leadStatus === 'ACTIVE'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            ✓ {leadStatus === 'ACTIVE' ? 'Esperando respuesta' : 'Consulta enviada'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setInquiryListingId(card.id)}
                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                            title="Enviar otra consulta"
                          >
                            ✉️
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInquiryListingId(card.id)}
                          className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
                        >
                          Quiero que me contacten
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {addToListCard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
                  <h3 className="font-bold text-slate-900 mb-4">Agregar a lista</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveToList(addToListCard.id, 'LATER')}
                      className="w-full py-2.5 px-4 bg-green-100 text-green-800 rounded-xl font-medium hover:bg-green-200 text-left"
                    >
                      👍 Mis like
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveToList(addToListCard.id, 'FAVORITE')}
                      className="w-full py-2.5 px-4 bg-amber-100 text-amber-800 rounded-xl font-medium hover:bg-amber-200 text-left"
                    >
                      ★ Mis favoritos
                    </button>
                    {customLists.length > 0 && (
                      <div className="border-t border-slate-200 pt-3 mt-1">
                        <p className="text-xs text-slate-700 font-medium mb-2">
                          O guardar en lista existente
                        </p>
                        <div className="flex flex-col gap-1">
                          {customLists.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => handleAddToCustomList(l.id)}
                              className="w-full py-2 px-4 bg-emerald-50 text-emerald-800 rounded-xl font-medium hover:bg-emerald-100 text-left"
                            >
                              📁 {l.name} ({l.count})
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2"
                      />
                      <button
                        type="button"
                        onClick={handleNuevaListaSubmit}
                        className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-xl font-medium hover:bg-blue-200"
                      >
                        Crear y agregar
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddToListCard(null);
                      setNewListName('');
                    }}
                    className="mt-4 w-full py-2 text-slate-700 text-sm hover:text-slate-900 font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {inquiryListingId && (
              <InquiryModal
                open={!!inquiryListingId}
                onClose={() => setInquiryListingId(null)}
                listingId={inquiryListingId}
                source="LIST"
                onSent={() => handleConsultaSent(inquiryListingId)}
              />
            )}
          </>
        )}

        {!loadingPreview && items.length === 0 && (
          <div className="text-center py-8 space-y-4">
            {hasSearched ? (
              <>
                <p className="text-gray-500">
                  No hay resultados con esos filtros. Probá ver el catálogo completo.
                </p>
                <button
                  type="button"
                  onClick={handleVerCatalogoCompleto}
                  disabled={loadingPreview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Ver catálogo completo
                </button>
              </>
            ) : (
              <p className="text-gray-500">
                Usá los filtros y hacé clic en &quot;Ver resultados ahora&quot;.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
