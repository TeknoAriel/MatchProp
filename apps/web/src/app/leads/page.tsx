'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HacersePremiumButton from '../../components/HacersePremiumButton';
import VisitScheduleModal from '../../components/VisitScheduleModal';
import PremiumGraceBanner from '../../components/PremiumGraceBanner';
import ListingCardImageCarousel from '../../components/ListingCardImageCarousel';
import { formatListingPrice } from '../../lib/format-price';

const API_BASE = '/api';
const GRACE_PERIOD = process.env.NEXT_PUBLIC_PREMIUM_GRACE_PERIOD === '1';
const YUMBLIN_TEST_PUSH =
  process.env.NEXT_PUBLIC_ENABLE_YUMBLIN_TEST_PUSH === '1';

type LastDelivery = {
  kind: string;
  status: string;
  httpStatus: number | null;
  createdAt: string;
  snippet: string | null;
  userMessage?: string;
};

type Lead = {
  id: string;
  listingId: string;
  status: string;
  source: string | null;
  message: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    locationText: string | null;
    propertyType?: string | null;
    heroImageUrl: string | null;
    media?: { url: string; sortOrder: number }[];
  };
  lastDelivery: LastDelivery | null;
  publisherReply: { body: string; createdAt: string } | null;
};

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Depto',
  HOUSE: 'Casa',
  PH: 'PH',
  LAND: 'Terreno',
  OFFICE: 'Oficina',
  COMMERCIAL: 'Local comercial',
  GARAGE: 'Cochera',
  WAREHOUSE: 'Galpón / depósito',
  OTHER: 'Otro',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [visitModalLeadId, setVisitModalLeadId] = useState<string | null>(null);
  const [showGraceToast, setShowGraceToast] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pushingYumblinTestId, setPushingYumblinTestId] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushErrorLeadId, setPushErrorLeadId] = useState<string | null>(null);
  const router = useRouter();

  const isPremium = premiumUntil && new Date(premiumUntil) > new Date();
  const canActivate = isPremium || GRACE_PERIOD;

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/me/leads`, { credentials: 'include' }).then((res) =>
        res.status === 401 ? null : res.json()
      ),
      fetch(`${API_BASE}/me`, { credentials: 'include' }).then((res) =>
        res.status === 401 ? null : res.json()
      ),
      fetch(`${API_BASE}/me/profile`, { credentials: 'include' }).then((res) =>
        res.ok ? res.json() : null
      ),
    ]).then(([leadsData, meData, profileData]) => {
      if (leadsData) setLeads(leadsData);
      if (meData?.premiumUntil) setPremiumUntil(meData.premiumUntil);
      if (profileData?.role === 'ADMIN') setIsAdmin(true);
      setLoading(false);
      if (meData === null || (meData && !meData.id)) router.replace('/login');
    });
  }, [router]);

  async function handleActivate(leadId: string) {
    if (activatingId) return;
    setActivatingId(leadId);
    try {
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined' && localStorage.getItem('matchprop_premium_sim') === '1') {
        headers['X-Premium-Sim'] = '1';
      }
      const res = await fetch(`${API_BASE}/leads/${leadId}/activate`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) throw new Error('Error al activar');
      const data = await res.json();
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: data.status ?? 'ACTIVE' } : l))
      );
      if (GRACE_PERIOD && !isPremium) {
        setShowGraceToast(true);
        setTimeout(() => setShowGraceToast(false), 8000);
      }
    } catch {
      setLeads((prev) => prev);
    } finally {
      setActivatingId(null);
    }
  }

  async function handlePushYumblinTest(leadId: string) {
    if (pushingYumblinTestId) return;
    setPushError(null);
    setPushErrorLeadId(null);
    setPushingYumblinTestId(leadId);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/push-yumblin-test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data: { ok?: boolean; httpStatus?: number; detail?: string } = await res.json().catch(
        () => ({})
      );

      if (data.ok) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: 'ACTIVE' } : l)));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPushError(msg);
      setPushErrorLeadId(leadId);
    } finally {
      setPushingYumblinTestId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="w-full">
        {GRACE_PERIOD && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--mp-premium)]/15 border border-[var(--mp-premium)]/40 text-sm text-slate-800">
            <p>
              <strong>Modo prueba:</strong> funciones premium habilitadas por 3–6 meses sin límites.{' '}
              <Link href="/me/premium" className="underline font-medium">
                Ver planes
              </Link>
            </p>
          </div>
        )}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Consultas y visitas</h1>
            <p className="text-xs text-slate-500 mt-0.5">Consultas enviadas y calendario de visitas</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/me/visits"
              className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 font-medium"
            >
              Visitas agendadas
            </Link>
            <Link
              href="/feed"
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              Match
            </Link>
            <Link
              href="/assistant"
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              Búsqueda
            </Link>
          </div>
        </div>

        {leads.some((l) => l.status === 'ACTIVE') && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-medium text-emerald-800">
              Tenés consultas activas. Coordiná visitas desde cada una con &quot;Agendar
              visita&quot;.
            </p>
            <Link
              href="/me/visits"
              className="inline-block mt-2 text-sm text-emerald-700 hover:underline font-medium"
            >
              Ver todas mis visitas →
            </Link>
          </div>
        )}

        {leads.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-12 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <p className="text-slate-700 text-lg font-medium">No tenés consultas enviadas.</p>
              <p className="text-slate-700 text-sm mt-2">
                Usá &quot;Quiero que me contacten&quot; en el feed para enviar tu primera consulta.
              </p>
              <Link
                href="/feed/list"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                Ir al feed
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Así se verán tus consultas
              </p>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden opacity-80">
                <div className="flex">
                  <div className="w-24 h-24 bg-slate-200 shrink-0" />
                  <div className="p-3 flex-1 min-w-0">
                    <p className="font-medium truncate text-slate-900">Depto 2 amb Palermo</p>
                    <p className="text-sm text-slate-600">USD 120.000</p>
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-800">
                      Pendiente
                    </span>
                  </div>
                </div>
                <span className="inline-block m-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded font-medium">
                  Ejemplo
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="block border rounded-lg overflow-hidden bg-white shadow-sm"
              >
                <div className="flex">
                  <Link href={`/listing/${lead.listingId}`} className="flex flex-1 min-w-0">
                    <div className="w-24 h-24 shrink-0 overflow-hidden relative group bg-gray-200">
                      <ListingCardImageCarousel
                        heroImageUrl={lead.listing.heroImageUrl}
                        media={lead.listing.media}
                        alt={lead.listing.title ?? ''}
                        className="w-full h-full object-cover"
                        fallbackClassName="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200"
                      />
                    </div>
                    <div className="p-3 flex-1 min-w-0">
                      {lead.listing.propertyType && (
                        <span className="inline-block mb-1 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600">
                          {PROPERTY_TYPE_LABEL[lead.listing.propertyType] ?? lead.listing.propertyType}
                        </span>
                      )}
                      <h2 className="font-medium truncate">{lead.listing.title ?? 'Sin título'}</h2>
                      <p className="text-sm text-gray-600">
                        {lead.listing.price != null
                          ? formatListingPrice(lead.listing.price, lead.listing.currency)
                          : 'Consultar'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{lead.listing.locationText}</p>
                      <div className="flex flex-wrap gap-1 mt-2 items-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded ${
                            lead.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : lead.status === 'CLOSED'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {STATUS_LABEL[lead.status] ?? lead.status}
                        </span>
                        {lead.lastDelivery && (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded ${
                              lead.lastDelivery.status === 'OK'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                            title={lead.lastDelivery.snippet ?? undefined}
                          >
                            {lead.lastDelivery.status === 'OK' ? 'SENT' : 'FAILED'}
                            {lead.lastDelivery.httpStatus != null
                              ? ` ${lead.lastDelivery.httpStatus}`
                              : ''}
                          </span>
                        )}
                      </div>
                      {lead.lastDelivery &&
                        lead.lastDelivery.status !== 'OK' &&
                        lead.lastDelivery.kind === 'KITEPROP' && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {lead.lastDelivery.userMessage && (
                              <p className="text-xs text-red-700">
                                {lead.lastDelivery.userMessage}
                              </p>
                            )}
                            {isAdmin && (
                              <Link
                                href="/settings/integrations/kiteprop"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Ir a integración Kiteprop
                              </Link>
                            )}
                          </div>
                        )}
                    </div>
                  </Link>
                </div>

                <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/80">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Tu consulta
                  </p>
                  <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">
                    {lead.message?.trim()
                      ? lead.message
                      : 'Consulta desde MatchProp (mensaje estándar).'}
                  </p>
                </div>

                {lead.status === 'ACTIVE' && (
                  <div className="px-3 py-2 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                      Respuesta de la inmobiliaria
                    </p>
                    {lead.publisherReply ? (
                      <div className="mt-2 rounded-lg bg-emerald-50/80 border border-emerald-100 p-3">
                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                          {lead.publisherReply.body}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(lead.publisherReply.createdAt).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 mt-2 italic">
                        Aún no te han respondido. Te avisamos cuando haya novedades.
                      </p>
                    )}
                  </div>
                )}

                {lead.status === 'PENDING' && (
                  <>
                  <div className="p-3 border-t bg-amber-50/50 space-y-2">
                    {canActivate ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleActivate(lead.id);
                          }}
                          disabled={!!activatingId}
                          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          {activatingId === lead.id ? 'Activando...' : 'Activar ahora'}
                        </button>
                        {GRACE_PERIOD && !isPremium && (
                          <p className="text-xs text-amber-800">
                            Función premium. Por ahora: período de prueba sin límites (3–6 meses).{' '}
                            <Link href="/me/premium" className="underline font-medium">
                              Ver planes
                            </Link>
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-amber-800">
                          Activá con Premium para ver contacto
                        </p>
                        <HacersePremiumButton variant="secondary" />
                      </div>
                    )}
                  </div>
                  {YUMBLIN_TEST_PUSH && isAdmin && (
                    <div className="pt-2 space-y-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePushYumblinTest(lead.id);
                        }}
                        disabled={pushingYumblinTestId === lead.id}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {pushingYumblinTestId === lead.id
                          ? 'Enviando...'
                          : 'Push Yumblin test (prop 34)'}
                      </button>
                      {pushError && pushErrorLeadId === lead.id && (
                        <p className="text-xs text-red-700 break-words">{pushError}</p>
                      )}
                    </div>
                  )}
                  </>
                )}
                {lead.status === 'ACTIVE' && (
                  <div className="p-3 border-t bg-emerald-50/50 dark:bg-emerald-900/20 flex flex-wrap gap-2">
                    <Link
                      href={`/leads/${lead.id}/chat`}
                      className="px-3 py-1.5 text-sm font-medium bg-[var(--mp-accent)] text-white rounded-xl hover:opacity-90"
                    >
                      Chat
                    </Link>
                    <button
                      type="button"
                      onClick={() => setVisitModalLeadId(lead.id)}
                      className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                    >
                      Agendar visita
                    </button>
                    <Link
                      href={`/leads/${lead.id}/visits`}
                      className="px-3 py-1.5 text-sm font-medium rounded-xl border border-[var(--mp-border)] bg-[var(--mp-card)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
                    >
                      Ver agenda
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showGraceToast && (
          <PremiumGraceBanner variant="toast" onDismiss={() => setShowGraceToast(false)} />
        )}
        {visitModalLeadId && (
          <VisitScheduleModal
            open={!!visitModalLeadId}
            onClose={() => setVisitModalLeadId(null)}
            leadId={visitModalLeadId}
            onScheduled={() => setVisitModalLeadId(null)}
          />
        )}
      </div>
    </main>
  );
}
