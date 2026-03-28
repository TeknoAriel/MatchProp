'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import HacersePremiumButton from '../../components/HacersePremiumButton';
import VisitScheduleModal from '../../components/VisitScheduleModal';
import PremiumGraceBanner from '../../components/PremiumGraceBanner';
import ListingImage from '../../components/ListingImage';
import { CardToolbar, ToolbarBtn, ToolbarLink } from '../../components/MpCardToolbar';
import { MpSecondaryNav, SECONDARY_NAV_LEADS } from '../../components/MpSecondaryNav';

const API_BASE = '/api';
const GRACE_PERIOD = process.env.NEXT_PUBLIC_PREMIUM_GRACE_PERIOD === '1';

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
  createdAt: string;
  listing: {
    id: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    locationText: string | null;
    heroImageUrl: string | null;
    publisherRef?: string | null;
    publisher?: { type: string; displayName: string } | null;
  };
  lastDelivery: LastDelivery | null;
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
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [filterOwnerType, setFilterOwnerType] = useState<'ALL' | 'OWNER' | 'INMOBILIARIA'>('ALL');
  const [filterSource, setFilterSource] = useState<'ALL' | 'ASSISTANT' | 'MANUAL'>('ALL');
  const [filterPublisher, setFilterPublisher] = useState('');
  const router = useRouter();
  const pathname = usePathname();

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
    ]).then(([leadsData, meData]) => {
      if (leadsData) setLeads(leadsData);
      if (meData?.premiumUntil) setPremiumUntil(meData.premiumUntil);
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
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900 mb-3">Mis consultas</h1>
          <MpSecondaryNav items={SECONDARY_NAV_LEADS} pathname={pathname} />
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
            {/* Filtros */}
            <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterOwnerType}
                  onChange={(e) => setFilterOwnerType(e.target.value as typeof filterOwnerType)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="ALL">Dueño/Inmobiliaria: todas</option>
                  <option value="OWNER">Dueño directo</option>
                  <option value="INMOBILIARIA">Inmobiliaria</option>
                </select>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="ALL">Origen: todos</option>
                  <option value="ASSISTANT">Asistente</option>
                  <option value="MANUAL">Manual</option>
                </select>
                <input
                  value={filterPublisher}
                  onChange={(e) => setFilterPublisher(e.target.value)}
                  placeholder="Filtrar por inmobiliaria (nombre)…"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">
                Agrupado por propiedad: verás una tarjeta por publicación, con todas tus consultas
                dentro.
              </p>
            </div>

            {(() => {
              const byListing = new Map<
                string,
                { listingId: string; listing: Lead['listing']; leads: Lead[] }
              >();
              for (const l of leads) {
                const g = byListing.get(l.listingId) ?? {
                  listingId: l.listingId,
                  listing: l.listing,
                  leads: [],
                };
                g.leads.push(l);
                byListing.set(l.listingId, g);
              }

              const groups = Array.from(byListing.values()).map((g) => {
                const latest = [...g.leads].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0];
                const publisherName = g.listing.publisher?.displayName ?? null;
                const publisherType = g.listing.publisher?.type ?? null;
                const ownerKind =
                  publisherType === 'OWNER'
                    ? 'OWNER'
                    : publisherType
                      ? 'INMOBILIARIA'
                      : 'INMOBILIARIA';
                return { ...g, latest, publisherName, publisherType, ownerKind };
              });

              const publisherNeedle = filterPublisher.trim().toLowerCase();
              const filtered = groups
                .filter((g) => (filterOwnerType === 'ALL' ? true : g.ownerKind === filterOwnerType))
                .filter((g) => {
                  if (filterSource === 'ALL') return true;
                  if (filterSource === 'ASSISTANT')
                    return g.leads.some((l) => l.source === 'ASSISTANT');
                  // Manual: cualquier source que no sea assistant (incluye FEED/LIST/DETAIL/DEMO/null)
                  return g.leads.some((l) => l.source !== 'ASSISTANT');
                })
                .filter((g) => {
                  if (!publisherNeedle) return true;
                  const name = (g.publisherName ?? '').toLowerCase();
                  return name.includes(publisherNeedle);
                })
                .sort(
                  (a, b) =>
                    new Date(b.latest?.createdAt ?? 0).getTime() -
                    new Date(a.latest?.createdAt ?? 0).getTime()
                );

              return filtered.map((group) => {
                const listing = group.listing;
                const priceText =
                  listing.price != null
                    ? `${listing.currency ?? 'USD'} ${listing.price.toLocaleString()}`
                    : 'Consultar';
                const expanded = expandedListingId === group.listingId;
                const publisherLabel =
                  group.ownerKind === 'OWNER' ? 'Dueño directo' : 'Inmobiliaria';
                const publisherName = group.publisherName ?? group.listing.publisherRef ?? '—';

                return (
                  <div key={group.listingId} className="mp-surface overflow-hidden">
                    <Link href={`/listing/${group.listingId}`} className="flex min-w-0">
                      <div className="w-24 h-24 shrink-0 overflow-hidden">
                        <ListingImage
                          src={listing.heroImageUrl}
                          alt={listing.title ?? ''}
                          fallbackClassName="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200"
                          fallbackIcon="🏠"
                          fallbackText=""
                        />
                      </div>
                      <div className="p-3 flex-1 min-w-0">
                        <h2 className="font-medium truncate text-[var(--mp-foreground)]">
                          {listing.title ?? 'Sin título'}
                        </h2>
                        <p className="text-sm text-[var(--mp-muted)]">{priceText}</p>
                        <p className="text-xs text-[var(--mp-muted)] truncate">
                          {listing.locationText}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2 items-center">
                          <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">
                            {group.leads.length} consulta{group.leads.length === 1 ? '' : 's'}
                          </span>
                          <span className="inline-block px-2 py-0.5 text-xs rounded bg-indigo-50 text-indigo-700">
                            {publisherLabel}: {publisherName}
                          </span>
                          {group.latest?.source && (
                            <span className="inline-block px-2 py-0.5 text-xs rounded bg-sky-50 text-sky-700">
                              Origen: {group.latest.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <CardToolbar>
                      <ToolbarLink
                        href={`/listing/${group.listingId}`}
                        icon="📄"
                        label="Ficha"
                        className="bg-sky-500 text-white !border-sky-600 hover:bg-sky-600"
                      />
                      <ToolbarBtn
                        icon={expanded ? '▲' : '▼'}
                        label={expanded ? 'Ocultar' : 'Consultas'}
                        className="bg-[var(--mp-card)] text-[var(--mp-foreground)] !border-[var(--mp-border)] hover:bg-[var(--mp-bg)]"
                        onClick={() => setExpandedListingId(expanded ? null : group.listingId)}
                      />
                    </CardToolbar>

                    {expanded && (
                      <div className="border-t border-[var(--mp-border)] bg-slate-50/40 p-3 space-y-2">
                        {group.leads.map((lead) => (
                          <div
                            key={lead.id}
                            className="rounded-xl bg-white border border-slate-100 overflow-hidden"
                          >
                            <div className="p-3 pb-2">
                              <div className="flex flex-wrap gap-1 items-center">
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
                                <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">
                                  {lead.source ?? 'MANUAL'}
                                </span>
                                <span className="text-xs text-slate-500" suppressHydrationWarning>
                                  {new Date(lead.createdAt).toLocaleString('es-AR')}
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
                                lead.lastDelivery.kind === 'KITEPROP' &&
                                lead.lastDelivery.userMessage && (
                                  <p className="text-xs text-red-700 mt-2">
                                    {lead.lastDelivery.userMessage}
                                  </p>
                                )}
                            </div>
                            {(lead.status === 'ACTIVE' || lead.status === 'PENDING') && (
                              <CardToolbar>
                                {lead.status === 'ACTIVE' && (
                                  <>
                                    <ToolbarLink
                                      href={`/leads/${lead.id}/chat`}
                                      icon="💬"
                                      label="Chat"
                                      className="bg-[var(--mp-accent)] text-white !border-[var(--mp-accent-hover)] hover:opacity-90"
                                    />
                                    <ToolbarBtn
                                      icon="📆"
                                      label="Agendar"
                                      className="bg-emerald-600 text-white !border-emerald-700 hover:bg-emerald-700"
                                      onClick={() => setVisitModalLeadId(lead.id)}
                                    />
                                    <ToolbarLink
                                      href={`/leads/${lead.id}/visits`}
                                      icon="📋"
                                      label="Agenda"
                                      className="bg-[var(--mp-card)] text-[var(--mp-foreground)] !border-[var(--mp-border)] hover:bg-[var(--mp-bg)]"
                                    />
                                  </>
                                )}
                                {lead.status === 'PENDING' && (
                                  <>
                                    {canActivate ? (
                                      <ToolbarBtn
                                        icon="▶"
                                        label={activatingId === lead.id ? '…' : 'Activar'}
                                        disabled={!!activatingId}
                                        className="bg-amber-600 text-white !border-amber-700 hover:bg-amber-700"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          void handleActivate(lead.id);
                                        }}
                                      />
                                    ) : (
                                      <span className="inline-flex shrink-0">
                                        <HacersePremiumButton
                                          variant="secondary"
                                          className="!min-h-[32px] !px-2 !py-1 !text-[11px] !rounded-[var(--mp-radius-chip)] !font-semibold"
                                        />
                                      </span>
                                    )}
                                  </>
                                )}
                              </CardToolbar>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
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
