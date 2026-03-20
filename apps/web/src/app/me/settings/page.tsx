'use client';

import { useEffect, useState } from 'react';
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
  adminOnly?: boolean;
}

const SECTIONS: SettingsSection[] = [
  // --- Integraciones Kiteprop (leads, delivery) ---
  {
    id: 'kiteprop',
    title: 'Kiteprop (leads)',
    description:
      'API, clave, spec OpenAPI, plantilla de payload. Envío de consultas a inmobiliarias.',
    href: '/settings/integrations/kiteprop',
    icon: '🔗',
    badge: 'Admin',
    adminOnly: true,
  },
  {
    id: 'importers',
    title: 'Fuentes de datos (Importadores)',
    description: 'URLs de difusiones Kiteprop: yumblin, zonaprop, etc. Formato JSON/xml.',
    href: '/settings/integrations/importers',
    icon: '📥',
    badge: 'Admin',
    adminOnly: true,
  },
  {
    id: 'sendgrid',
    title: 'SendGrid (Magic Link)',
    description: 'API key y email remitente para links de login por correo.',
    href: '/settings/integrations/sendgrid',
    icon: '📧',
    badge: 'Admin',
    adminOnly: true,
  },
  // --- API y conectores ---
  {
    id: 'api-universal',
    title: 'API Universal',
    description:
      'Endpoints REST públicos para integradores (feed, listings). Autenticación por API key.',
    href: '/settings/integrations/api-universal',
    icon: '🔌',
    badge: 'Admin',
    adminOnly: true,
  },
  {
    id: 'crm-portales',
    title: 'CRM y portales',
    description: 'Webhook CRM, API Partner. Panel Admin puerto 3002.',
    icon: '🏢',
    badge: 'Admin',
    adminOnly: true,
  },
  // --- Pagos ---
  {
    id: 'pasarela-pago',
    title: 'Pasarela de pago',
    description: 'Stripe B2C, planes Premium. Configuración y estado.',
    href: '/settings/integrations/payments',
    icon: '💳',
    badge: 'Admin',
    adminOnly: true,
  },
  // --- Asistente (solo admin: ariel@kiteprop.com, jonas@, soporte@) ---
  {
    id: 'asistente-ai',
    title: 'Asistente IA',
    description: 'Usuario, contraseña, API key y token para LLM (OpenAI, Claude). Búsqueda y chat.',
    href: '/settings/integrations/assistant',
    icon: '🤖',
    badge: 'Admin',
    adminOnly: true,
  },
  {
    id: 'asistencia-voz',
    title: 'Asistente de voz',
    description:
      'Config igual al Asistente IA: usuario, contraseña, API key y token para búsqueda por voz y conversacional.',
    href: '/settings/integrations/assistant-voice',
    icon: '🎤',
    badge: 'Admin',
    adminOnly: true,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [profileDone, setProfileDone] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/me/profile`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.role) setRole(data.role);
      })
      .catch(() => {})
      .finally(() => setProfileDone(true));
  }, [router]);

  const isAdmin = role === 'ADMIN';
  // Mostrar siempre todas las secciones para que el menú no quede vacío si /me/profile falla (ej. 404).
  // El backend devuelve 403 en integraciones para no-admin.
  const sectionsToShow =
    profileDone && !isAdmin && role !== null ? SECTIONS.filter((s) => !s.adminOnly) : SECTIONS;

  return (
    <main className="p-4 md:p-6">
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

        {profileDone && role === null && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            No se pudo cargar el perfil. Si sos admin, verificá que la API esté conectada (ver{' '}
            <code className="bg-amber-100 px-1 rounded">docs/CONEXIONES_VERIFICACION.md</code>). Las
            opciones siguientes pueden requerir rol Admin.
          </div>
        )}

        <div className="space-y-3">
          {sectionsToShow.map((s) => {
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
