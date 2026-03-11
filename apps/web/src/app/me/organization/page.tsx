'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = '/api';

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  inviteUrl: string;
};

type OrgData = {
  name?: string | null;
  commercialName?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
};

export default function OrganizationPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'AGENT' | 'REALTOR'>('AGENT');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function load() {
    Promise.all([
      fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE}/me/organization/invitations`, { credentials: 'include' }).then((r) => {
        if (r.status === 401) {
          router.replace('/login');
          return { invitations: [] };
        }
        return r.json();
      }),
    ])
      .then(([profile, data]) => {
        setOrg(profile?.organization ?? null);
        setInvitations(data?.invitations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [router]);

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setOrgSaving(true);
    fetch(`${API_BASE}/me/organization`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(org),
    })
      .then((res) => (res.ok ? res.json() : res.json().then((body) => Promise.reject(body))))
      .then(() => setOrgSaving(false))
      .catch(() => setOrgSaving(false));
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Ingresá un email');
      return;
    }
    setSending(true);
    fetch(`${API_BASE}/me/organization/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setError(data.message);
        } else {
          setEmail('');
          load();
        }
      })
      .catch(() => setError('Error al crear invitación'))
      .finally(() => setSending(false));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="h-24 w-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mi inmobiliaria — Equipo</h1>
          <Link
            href="/me/profile"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200"
          >
            Mi perfil
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
          <section className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-3">Datos de la inmobiliaria</h2>
            <form onSubmit={handleOrgSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Nombre de la inmobiliaria
                </label>
                <input
                  type="text"
                  value={org?.name ?? ''}
                  onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Ej: Inmobiliaria Sur"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre comercial</label>
                <input
                  type="text"
                  value={org?.commercialName ?? ''}
                  onChange={(e) =>
                    setOrg((o) => ({ ...o, commercialName: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Domicilio</label>
                <input
                  type="text"
                  value={org?.address ?? ''}
                  onChange={(e) => setOrg((o) => ({ ...o, address: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Calle, número, localidad"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tel</label>
                <input
                  type="text"
                  value={org?.phone ?? ''}
                  onChange={(e) => setOrg((o) => ({ ...o, phone: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Teléfono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={org?.whatsapp ?? ''}
                  onChange={(e) => setOrg((o) => ({ ...o, whatsapp: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Número WhatsApp"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Web / Mail de contacto</label>
                <input
                  type="text"
                  value={org?.website ?? ''}
                  onChange={(e) => setOrg((o) => ({ ...o, website: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="https://... o email"
                />
              </div>
              <p className="text-xs text-slate-500">
                Matrícula a cargo: editá el campo Matrícula en{' '}
                <Link href="/me/profile" className="text-blue-600 hover:underline">
                  Mi perfil
                </Link>
                .
              </p>
              <button
                type="submit"
                disabled={orgSaving}
                className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {orgSaving ? 'Guardando...' : 'Guardar datos'}
              </button>
            </form>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Invitar agente o corredor</h2>
            <p className="text-sm text-slate-600 mb-4">
              Quien acepte la invitación se sumará a tu inmobiliaria y tendrá 20% de descuento en su
              plan Premium.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="agente@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'AGENT' | 'REALTOR')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="AGENT">Agente</option>
                  <option value="REALTOR">Corredor inmobiliario</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Crear invitación'}
              </button>
            </form>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Invitaciones pendientes</h2>
            {invitations.length === 0 ? (
              <p className="text-sm text-slate-500">No hay invitaciones.</p>
            ) : (
              <ul className="space-y-3">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl text-sm"
                  >
                    <div>
                      <span className="font-medium">{inv.email}</span>
                      <span className="text-slate-500 ml-2">
                        {inv.role === 'AGENT' ? 'Agente' : 'Corredor'}
                      </span>
                      {inv.usedAt ? (
                        <span className="ml-2 text-green-600">Aceptada</span>
                      ) : new Date(inv.expiresAt) < new Date() ? (
                        <span className="ml-2 text-slate-400">Expirada</span>
                      ) : null}
                    </div>
                    {!inv.usedAt && new Date(inv.expiresAt) >= new Date() && (
                      <button
                        type="button"
                        onClick={() => copyUrl(inv.inviteUrl)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Copiar enlace
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
