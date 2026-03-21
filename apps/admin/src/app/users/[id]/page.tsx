/**
 * Admin: ficha editable por usuario (perfil + organización + plan/vigencia)
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type PlanKey = 'BUYER' | 'AGENT' | 'REALTOR' | 'INMOBILIARIA';
type BillingCycle = 'monthly' | 'yearly';

type Profile = Record<string, unknown> | null;
type Organization = Record<string, unknown> | null;

type ProfileKey =
  | 'firstName'
  | 'lastName'
  | 'dni'
  | 'matricula'
  | 'phone'
  | 'whatsapp'
  | 'telegram'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'website'
  | 'address'
  | 'avatarUrl';

type OrgKey =
  | 'name'
  | 'commercialName'
  | 'address'
  | 'phone'
  | 'whatsapp'
  | 'telegram'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'website';

type ProfileDraft = Partial<Record<ProfileKey, string | null>>;
type OrgDraft = Partial<Record<OrgKey, string | null>>;

type AdminUserDetail = {
  user: {
    id: string;
    email: string;
    role: string;
    premiumUntil: string | null;
    daysRemaining: number;
    organizationId: string | null;
    profile: Profile;
    organization: Organization;
  };
  stats: {
    savedListsCount: number;
    savedItemsCount: number;
    savedSearchesCount: number;
    leadsCount: number;
    visitsCount: number;
  };
  subscriptionsRecent: {
    id: string;
    plan: string;
    status: string;
    provider: string;
    currentPeriodEnd: string;
  }[];
};

function emptyStringToNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUserDetail | null>(null);

  const [tab, setTab] = useState<'ficha' | 'plan' | 'perfil' | 'organizacion'>('ficha');
  const isAdminUser = data?.user.role === 'ADMIN';

  const [plan, setPlan] = useState<PlanKey>('BUYER');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [graceDays, setGraceDays] = useState<number>(0);
  const [savingPlan, setSavingPlan] = useState(false);

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({});
  const [orgDraft, setOrgDraft] = useState<OrgDraft>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  const initFromData = (d: AdminUserDetail) => {
    const role = d.user.role;
    if (role === 'ADMIN') {
      setPlan('BUYER');
    } else {
      setPlan(role as PlanKey);
    }
    setBillingCycle('monthly');
    setGraceDays(0);

    const profileObj = (d.user.profile ?? {}) as Record<string, unknown>;
    const orgObj = (d.user.organization ?? {}) as Record<string, unknown>;

    const getProfileValue = (key: ProfileKey): string | null => {
      return typeof profileObj[key] === 'string' ? emptyStringToNull(profileObj[key]) : null;
    };
    const getOrgValue = (key: OrgKey): string | null => {
      return typeof orgObj[key] === 'string' ? emptyStringToNull(orgObj[key]) : null;
    };

    setProfileDraft({
      firstName: getProfileValue('firstName'),
      lastName: getProfileValue('lastName'),
      dni: getProfileValue('dni'),
      matricula: getProfileValue('matricula'),
      phone: getProfileValue('phone'),
      whatsapp: getProfileValue('whatsapp'),
      telegram: getProfileValue('telegram'),
      twitter: getProfileValue('twitter'),
      instagram: getProfileValue('instagram'),
      facebook: getProfileValue('facebook'),
      website: getProfileValue('website'),
      address: getProfileValue('address'),
      avatarUrl: getProfileValue('avatarUrl'),
    });

    setOrgDraft({
      name: getOrgValue('name'),
      commercialName: getOrgValue('commercialName'),
      address: getOrgValue('address'),
      phone: getOrgValue('phone'),
      whatsapp: getOrgValue('whatsapp'),
      telegram: getOrgValue('telegram'),
      twitter: getOrgValue('twitter'),
      instagram: getOrgValue('instagram'),
      facebook: getOrgValue('facebook'),
      website: getOrgValue('website'),
    });
  };

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`${API_BASE}/admin/users/${userId}`, { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: AdminUserDetail | null) => {
        if (!mounted) return;
        if (!d) {
          setError('No se pudo cargar la ficha del usuario.');
          setData(null);
          return;
        }
        setData(d);
        initFromData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const planKeys: PlanKey[] = ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'];

  const profileFields: Array<[ProfileKey, string]> = useMemo(
    () => [
      ['firstName', 'Nombre'],
      ['lastName', 'Apellido'],
      ['dni', 'DNI'],
      ['matricula', 'Matrícula'],
      ['phone', 'Teléfono'],
      ['whatsapp', 'WhatsApp'],
      ['telegram', 'Telegram'],
      ['twitter', 'Twitter'],
      ['instagram', 'Instagram'],
      ['facebook', 'Facebook'],
      ['website', 'Website'],
      ['address', 'Dirección'],
      ['avatarUrl', 'Avatar URL'],
    ],
    []
  );

  const orgFields: Array<[OrgKey, string]> = useMemo(
    () => [
      ['name', 'Nombre'],
      ['commercialName', 'Nombre comercial'],
      ['address', 'Dirección'],
      ['phone', 'Teléfono'],
      ['whatsapp', 'WhatsApp'],
      ['telegram', 'Telegram'],
      ['twitter', 'Twitter'],
      ['instagram', 'Instagram'],
      ['facebook', 'Facebook'],
      ['website', 'Website'],
    ],
    []
  );

  async function saveProfile() {
    if (!data) return;
    setSavingProfile(true);
    try {
      const body = Object.fromEntries(
        Object.entries(profileDraft).map(([k, v]) => [k, v === undefined ? undefined : v])
      );
      const res = await fetch(`${API_BASE}/admin/users/${data.user.id}/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Error guardando perfil (HTTP ${res.status})`);
      const refreshed = await fetch(`${API_BASE}/admin/users/${data.user.id}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (refreshed.ok) {
        const d = (await refreshed.json()) as AdminUserDetail;
        setData(d);
        initFromData(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveOrganization() {
    if (!data) return;
    setSavingOrg(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${data.user.id}/organization`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgDraft),
      });
      if (!res.ok) throw new Error(`Error guardando organización (HTTP ${res.status})`);
      const refreshed = await fetch(`${API_BASE}/admin/users/${data.user.id}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (refreshed.ok) {
        const d = (await refreshed.json()) as AdminUserDetail;
        setData(d);
        initFromData(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingOrg(false);
    }
  }

  async function applyPlan() {
    if (!data) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/assign-plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.user.email,
          plan,
          billingCycle,
          graceDays,
        }),
      });
      if (!res.ok) throw new Error(`Error asignando plan (HTTP ${res.status})`);
      const refreshed = await fetch(`${API_BASE}/admin/users/${data.user.id}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (refreshed.ok) {
        const d = (await refreshed.json()) as AdminUserDetail;
        setData(d);
        initFromData(d);
      }
      setTab('ficha');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPlan(false);
    }
  }

  if (loading) return <main className="min-h-screen p-6">Cargando…</main>;
  if (error) return <main className="min-h-screen p-6 text-red-600">{error}</main>;
  if (!data) return <main className="min-h-screen p-6">No hay datos.</main>;

  return (
    <main className="min-h-screen p-6">
      <Link href="/users" className="text-sm text-blue-600 hover:underline">
        ← Usuarios
      </Link>
      <h1 className="mt-4 text-xl font-bold">Ficha de usuario</h1>
      <div className="mt-1 text-sm text-gray-600">
        <span className="font-mono text-xs">{data.user.email}</span>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {(['ficha', 'plan', 'perfil', 'organizacion'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-lg text-sm border ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {t === 'ficha'
              ? 'Ficha'
              : t === 'plan'
                ? 'Plan y gracia'
                : t === 'perfil'
                  ? 'Perfil'
                  : 'Organización'}
          </button>
        ))}
      </div>

      {tab === 'ficha' && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded p-3 text-sm">
            <div className="text-gray-600">Rol</div>
            <div className="font-semibold">{data.user.role}</div>
            <div className="mt-3 text-gray-600">Premium hasta</div>
            <div className="font-semibold">
              {data.user.premiumUntil ? new Date(data.user.premiumUntil).toLocaleString() : '—'}
            </div>
            <div className="mt-2 text-gray-700">
              Días restantes: <span className="font-semibold">{data.user.daysRemaining}</span>
            </div>
          </div>

          <div className="border rounded p-3 text-sm md:col-span-2">
            <div className="text-gray-600">Evaluación / asignación (stats rápidos)</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-600">Saved lists</div>
                <div className="font-semibold">{data.stats.savedListsCount}</div>
              </div>
              <div>
                <div className="text-gray-600">Saved items</div>
                <div className="font-semibold">{data.stats.savedItemsCount}</div>
              </div>
              <div>
                <div className="text-gray-600">Saved searches</div>
                <div className="font-semibold">{data.stats.savedSearchesCount}</div>
              </div>
              <div>
                <div className="text-gray-600">Leads</div>
                <div className="font-semibold">{data.stats.leadsCount}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-gray-600">Visitas</div>
                <div className="font-semibold">{data.stats.visitsCount}</div>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 text-sm md:col-span-3">
            <div className="text-gray-600">Suscripciones recientes</div>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2 text-left border">Plan</th>
                    <th className="p-2 text-left border">Estado</th>
                    <th className="p-2 text-left border">Proveedor</th>
                    <th className="p-2 text-left border">Fin período</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptionsRecent.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-2 text-gray-500">
                        Sin suscripciones.
                      </td>
                    </tr>
                  ) : (
                    data.subscriptionsRecent.map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className="p-2 border">{s.plan}</td>
                        <td className="p-2 border">{s.status}</td>
                        <td className="p-2 border">{s.provider}</td>
                        <td className="p-2 border">
                          {new Date(s.currentPeriodEnd).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div className="mt-4 border rounded p-4">
          {isAdminUser ? (
            <p className="text-gray-700">
              Este usuario tiene rol <span className="font-semibold">{data.user.role}</span>. No se
              aplica plan.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Plan</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as PlanKey)}
                  >
                    {planKeys.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Ciclo</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                  >
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Gracia (días)</label>
                  <input
                    type="number"
                    className="border rounded px-3 py-2 w-full"
                    min={0}
                    max={3650}
                    value={graceDays}
                    onChange={(e) => setGraceDays(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={applyPlan}
                  disabled={savingPlan}
                  className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingPlan ? 'Aplicando…' : 'Aplicar plan + vigencia'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('ficha')}
                  className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Volver
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600">
                La vigencia se calcula como: período (mensual/anual) +{' '}
                <span className="font-semibold">{graceDays}</span> días de gracia.
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'perfil' && (
        <div className="mt-4 border rounded p-4">
          <div className="text-sm text-gray-600">Perfil del usuario</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profileFields.map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-600">{label}</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={profileDraft[key] ?? ''}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingProfile ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        </div>
      )}

      {tab === 'organizacion' && (
        <div className="mt-4 border rounded p-4">
          <div className="text-sm text-gray-600">Organización (asociada al usuario)</div>
          {!data.user.organizationId ? (
            <p className="mt-2 text-gray-700">Este usuario no tiene organización asociada.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orgFields.map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600">{label}</label>
                    <input
                      className="border rounded px-3 py-2 w-full"
                      value={orgDraft[key] ?? ''}
                      onChange={(e) => setOrgDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={saveOrganization}
                  disabled={savingOrg}
                  className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingOrg ? 'Guardando…' : 'Guardar organización'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
