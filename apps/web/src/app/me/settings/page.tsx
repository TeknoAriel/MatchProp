'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  href?: string;
  external?: boolean;
  icon: string;
  badge?: string;
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'kiteprop',
    title: 'Integración Kiteprop',
    description:
      'Configurar API, clave, spec OpenAPI, plantilla de payload y probar envío de leads.',
    href: '/settings/integrations/kiteprop',
    icon: '🔗',
    badge: 'Agentes',
  },
  {
    id: 'cargas-json',
    title: 'Cargas JSON',
    description:
      'Ingest desde Zonaprop, Toctoc, iCasas y otros portales. Scripts: ingest:run, ingest:fixture-refresh. Ver docs/repo-map.md.',
    icon: '📥',
    badge: 'Backend',
  },
  {
    id: 'crm-portales',
    title: 'CRM y portales',
    description:
      'Webhook para CRM (listing.matches_found), API Partner. Panel Admin en puerto 3002.',
    icon: '🏢',
    badge: 'Admin',
  },
  {
    id: 'api-universal',
    title: 'API Universal',
    description:
      'Endpoints REST para integradores: feed, searches, leads, assistant. Ver repo-map y documentación.',
    icon: '🔌',
    badge: 'Desarrolladores',
  },
  {
    id: 'pasarela-pago',
    title: 'Pasarela de pago',
    description: 'Stripe B2C, planes Premium por rol. Configurar precios y webhooks.',
    href: '/me/premium',
    icon: '💳',
  },
  {
    id: 'asistente-ai',
    title: 'Asistente AI de búsqueda',
    description: 'Parser texto → filtros. Ejemplos configurables. Búsqueda natural en lenguaje.',
    href: '/assistant',
    icon: '🤖',
  },
  {
    id: 'asistencia-voz',
    title: 'Asistencia por voz',
    description: 'Web Speech API. Buscar por voz con el micrófono desde el asistente.',
    href: '/assistant',
    icon: '🎤',
  },
];

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) router.replace('/login');
      })
      .catch(() => {});
  }, [router]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--mp-foreground)]">
              {PRODUCT_NAME} — Configuraciones
            </h1>
            <p className="text-sm text-[var(--mp-muted)] mt-1">
              Acceso a integraciones, APIs, pasarela de pago y asistentes
            </p>
          </div>
          <Link
            href="/me/profile"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--mp-card)] border border-[var(--mp-border)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
          >
            Volver al perfil
          </Link>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((s) => {
            const content = (
              <div
                className={`flex items-start gap-4 p-4 rounded-2xl border bg-[var(--mp-card)] border-[var(--mp-border)] transition-colors ${
                  s.href && !s.external ? 'hover:border-[var(--mp-accent)]/50 cursor-pointer' : ''
                }`}
              >
                <span className="text-2xl shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-[var(--mp-foreground)]">{s.title}</h2>
                    {s.badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--mp-accent)]/20 text-[var(--mp-accent)] font-medium">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--mp-muted)] mt-1">{s.description}</p>
                  {s.href && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--mp-accent)] mt-2">
                      {s.external ? 'Ver documentación →' : 'Configurar →'}
                    </span>
                  )}
                </div>
                {s.href && <span className="text-[var(--mp-muted)] shrink-0">→</span>}
              </div>
            );

            if (s.href) {
              if (s.external) {
                return (
                  <a
                    key={s.id}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link key={s.id} href={s.href}>
                  {content}
                </Link>
              );
            }
            return <div key={s.id}>{content}</div>;
          })}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-[var(--mp-bg)] border border-[var(--mp-border)]">
          <p className="text-xs text-[var(--mp-muted)]">
            Algunas configuraciones (CRM webhook, ingest, API Partner) se gestionan mediante
            variables de entorno o el panel Admin (puerto 3002). Ver{' '}
            <code className="px-1 py-0.5 rounded bg-[var(--mp-card)]">
              docs/AUDITORIA_FULLSTACK.md
            </code>{' '}
            y <code className="px-1 py-0.5 rounded bg-[var(--mp-card)]">docs/repo-map.md</code> para
            más detalles.
          </p>
        </div>
      </div>
    </main>
  );
}
