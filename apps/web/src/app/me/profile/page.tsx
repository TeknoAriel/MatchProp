'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProfileModal from '../../../components/ProfileModal';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

const ROLE_LABELS: Record<string, string> = {
  BUYER: 'Usuario',
  AGENT: 'Agente',
  REALTOR: 'Corredor inmobiliario',
  INMOBILIARIA: 'Inmobiliaria',
  ADMIN: 'Administrador',
};

export default function ProfilePage() {
  const [data, setData] = useState<{
    email: string;
    role: string;
    premiumUntil: string | null;
    profile: Record<string, string | null> | null;
    organization: Record<string, string | null> | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="h-24 w-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen p-4">
        <p className="text-slate-600">No se pudo cargar el perfil.</p>
        <Link href="/feed" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver al inicio
        </Link>
      </main>
    );
  }

  const p = data.profile ?? {};
  const isPremium = !!(data.premiumUntil && new Date(data.premiumUntil) > new Date());

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{PRODUCT_NAME} — Mi perfil</h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/me/settings"
              className="px-4 py-2 rounded-xl font-medium text-[var(--mp-foreground)] border border-[var(--mp-border)] hover:bg-[var(--mp-bg)]"
            >
              ⚙️ Configuraciones
            </Link>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              Editar
            </button>
            <Link
              href="/feed"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200"
            >
              Volver
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          {/* Avatar y nombre */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-300">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-400">👤</span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">
                {p.firstName || p.lastName
                  ? [p.firstName, p.lastName].filter(Boolean).join(' ')
                  : 'Sin nombre'}
              </h2>
              <span className="text-sm text-slate-500">{data.email}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-500">Rol</span>
            <p className="font-medium">{ROLE_LABELS[data.role] ?? data.role}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Premium</span>
            <p className="font-medium">
              {isPremium ? (
                <>Activo hasta {new Date(data.premiumUntil!).toLocaleDateString('es-AR')}</>
              ) : (
                <span className="text-amber-600">Sin premium activo</span>
              )}
            </p>
            <Link href="/me/premium" className="text-sm text-blue-600 hover:underline">
              Ver planes
            </Link>
          </div>

          {p.dni && (
            <div>
              <span className="text-xs text-slate-500">DNI</span>
              <p>{p.dni}</p>
            </div>
          )}
          {p.matricula && (
            <div>
              <span className="text-xs text-slate-500">Matrícula</span>
              <p>{p.matricula}</p>
            </div>
          )}
          {p.address && (
            <div>
              <span className="text-xs text-slate-500">Domicilio</span>
              <p>{p.address}</p>
            </div>
          )}
          {(p.phone || p.whatsapp || p.telegram) && (
            <div>
              <span className="text-xs text-slate-500">Contacto</span>
              <p>
                {[
                  p.phone && `Tel: ${p.phone}`,
                  p.whatsapp && `WS: ${p.whatsapp}`,
                  p.telegram && `TG: ${p.telegram}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}

          {data.organization && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <span className="text-xs text-slate-500">Inmobiliaria</span>
              <p className="font-medium">
                {data.organization.name ?? data.organization.commercialName ?? '-'}
              </p>
              {data.role === 'INMOBILIARIA' && (
                <Link
                  href="/me/organization"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  Invitar agentes o corredores →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <ProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
            .then((r) => r.json())
            .then(setData);
        }}
      />
    </main>
  );
}
