'use client';

import { useEffect, useState, useCallback, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SavedSearchDTO } from '@matchprop/shared';
import ActiveSearchBar from '../../components/ActiveSearchBar';
import SavedSearchCard, {
  EditSearchModal,
  type AlertTypeSaved,
  type SubStateSaved,
  type AlertDeliverySaved,
} from '../../components/SavedSearchCard';

const API_BASE = '/api';

type AlertType = AlertTypeSaved;
type SubState = SubStateSaved;
type AlertDelivery = AlertDeliverySaved;

export default function SearchesPage() {
  const router = useRouter();
  const [items, setItems] = useState<SavedSearchDTO[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [subsBySearch, setSubsBySearch] = useState<Record<string, Record<AlertType, SubState>>>({});
  const [deliveriesBySearch, setDeliveriesBySearch] = useState<Record<string, AlertDelivery[]>>({});

  const fetchItems = useCallback(() => {
    return Promise.all([
      fetch(`${API_BASE}/searches`, { credentials: 'include' }),
      fetch(`${API_BASE}/me/active-search`, { credentials: 'include' }),
    ]).then(async ([resSearches, resActive]) => {
      if (resSearches.status === 401 || resActive.status === 401) {
        setSessionExpired(true);
        setItems([]);
        return;
      }
      if (!resSearches.ok) {
        setApiDown(true);
        return;
      }
      const data = await resSearches.json();
      setItems(Array.isArray(data) ? data : []);
      const activeData = resActive.ok ? await resActive.json() : {};
      setActiveSearchId(activeData.search?.id ?? null);
    });
  }, []);

  useEffect(() => {
    fetchItems()
      .catch(() => setApiDown(true))
      .finally(() => setLoading(false));
  }, [fetchItems]);

  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((s) => s.id);
    Promise.all([
      fetch(`${API_BASE}/alerts/subscriptions`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      ),
      ...ids.map((id) =>
        fetch(`${API_BASE}/alerts/deliveries/by-search/${id}?limit=5`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : { deliveries: [] }))
      ),
    ]).then(([subsList, ...deliveryResults]) => {
      const subsMap: Record<string, Record<AlertType, SubState>> = {};
      ids.forEach((id) => {
        subsMap[id] = {
          NEW_LISTING: null,
          PRICE_DROP: null,
          BACK_ON_MARKET: null,
        };
      });
      for (const s of subsList ?? []) {
        if (s.savedSearchId && ids.includes(s.savedSearchId)) {
          const t = s.type as AlertType;
          if (t in subsMap[s.savedSearchId]!) {
            subsMap[s.savedSearchId]![t] = { id: s.id, isEnabled: s.isEnabled };
          }
        }
      }
      setSubsBySearch(subsMap);

      const delMap: Record<string, AlertDelivery[]> = {};
      ids.forEach((id, i) => {
        const d = deliveryResults[i] as { deliveries?: AlertDelivery[] };
        delMap[id] = d?.deliveries ?? [];
      });
      setDeliveriesBySearch(delMap);
    });
  }, [items]);

  async function handleSetActive(searchId: string) {
    const res = await fetch(`${API_BASE}/me/active-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchId }),
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) setActiveSearchId(searchId);
  }

  async function handleMatch(searchId: string) {
    await handleSetActive(searchId);
    router.push('/feed');
  }

  function handleEditOpen(s: SavedSearchDTO) {
    setEditingId(s.id);
    setEditName(s.name || '');
    setEditText(s.queryText || '');
  }

  async function handleEditSave() {
    if (!editingId || editSaving) return;
    setEditSaving(true);
    try {
      let body: { name?: string; text?: string; filters?: unknown } = {
        name: editName.trim() || undefined,
      };
      if (editText.trim().length >= 3) {
        const parseRes = await fetch(`${API_BASE}/assistant/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: editText.trim() }),
        });
        if (parseRes.ok) {
          const parsed = await parseRes.json();
          body = { ...body, text: editText.trim(), filters: parsed.filters };
        }
      }
      const res = await fetch(`${API_BASE}/searches/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) router.replace('/login');
      else if (res.ok) {
        await fetchItems();
        setEditingId(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(searchId: string) {
    const res = await fetch(`${API_BASE}/searches/${searchId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) router.replace('/login');
    else if (res.ok) {
      setItems((prev) => prev.filter((s) => s.id !== searchId));
      setDeleteConfirmId(null);
      if (activeSearchId === searchId) setActiveSearchId(null);
    }
  }

  async function handleAlert(searchId: string, type: AlertType, enable: boolean) {
    const sub = subsBySearch[searchId]?.[type];
    if (sub) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: enable }),
      });
      if (res.ok) {
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? {
            NEW_LISTING: null,
            PRICE_DROP: null,
            BACK_ON_MARKET: null,
          };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING:
              type === 'NEW_LISTING' ? { ...sub, isEnabled: enable } : (base.NEW_LISTING ?? null),
            PRICE_DROP:
              type === 'PRICE_DROP' ? { ...sub, isEnabled: enable } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET:
              type === 'BACK_ON_MARKET'
                ? { ...sub, isEnabled: enable }
                : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    } else if (enable) {
      const res = await fetch(`${API_BASE}/alerts/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ savedSearchId: searchId, type }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubsBySearch((prev) => {
          const base = prev[searchId] ?? {
            NEW_LISTING: null,
            PRICE_DROP: null,
            BACK_ON_MARKET: null,
          };
          const updated: Record<AlertType, SubState> = {
            NEW_LISTING:
              type === 'NEW_LISTING'
                ? { id: data.id, isEnabled: true }
                : (base.NEW_LISTING ?? null),
            PRICE_DROP:
              type === 'PRICE_DROP' ? { id: data.id, isEnabled: true } : (base.PRICE_DROP ?? null),
            BACK_ON_MARKET:
              type === 'BACK_ON_MARKET'
                ? { id: data.id, isEnabled: true }
                : (base.BACK_ON_MARKET ?? null),
          };
          return { ...prev, [searchId]: updated };
        });
      }
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (sessionExpired) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <p className="text-amber-600">Sesión vencida.</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  if (apiDown) {
    return (
      <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-4">
        <p className="text-amber-600">No hay conexión con la API.</p>
        <Link
          href="/status"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ver estado de conexión
        </Link>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Ir a login
        </Link>
      </main>
    );
  }

  const cardProps = (s: SavedSearchDTO): ComponentProps<typeof SavedSearchCard> => ({
    s,
    activeSearchId,
    expandedId,
    onToggleExpand: (id) => setExpandedId((prev) => (prev === id ? null : id)),
    deleteConfirmId,
    setDeleteConfirmId,
    subsBySearch,
    deliveriesBySearch,
    onMatch: handleMatch,
    onEditOpen: handleEditOpen,
    onSetActive: handleSetActive,
    onDelete: handleDelete,
    onAlert: handleAlert,
  });

  return (
    <main className="min-h-screen p-4">
      <ActiveSearchBar />
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-4 mb-6">
          <Link href="/feed" className="text-sm text-sky-600 hover:underline">
            ← Feed
          </Link>
          <Link href="/assistant" className="text-sm text-sky-600 hover:underline">
            Asistente
          </Link>
          <Link href="/alerts" className="text-sm text-sky-600 hover:underline">
            Alertas
          </Link>
        </div>

        <h1 className="text-xl font-bold mb-4">Búsquedas guardadas</h1>

        <div className="space-y-4">
          {items.map((s) => (
            <SavedSearchCard key={s.id} {...cardProps(s)} />
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No tenés búsquedas guardadas. Creá una desde el{' '}
            <Link href="/assistant" className="text-sky-600 hover:underline">
              asistente
            </Link>
            .
          </p>
        )}
      </div>

      <EditSearchModal
        open={!!editingId}
        editName={editName}
        editText={editText}
        editSaving={editSaving}
        onEditName={setEditName}
        onEditText={setEditText}
        onSave={handleEditSave}
        onClose={() => setEditingId(null)}
      />
    </main>
  );
}
