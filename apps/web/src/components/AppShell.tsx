'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { NOTIFICATIONS_CHANGED_EVENT } from '../lib/notificationEvents';

/**
 * Flujo principal (masterplan v3.2): una acción clara por nivel.
 * "Más" abre el centro de control (secciones claras, sin mezclar IA con cuenta).
 */
const NAV_PRIMARY = [
  { href: '/dashboard', label: 'Buscar', icon: '🔍' },
  { href: '/feed', label: 'Match', icon: '🎯' },
  { href: '/me/match', label: 'Mis match', icon: '🔥' },
  { href: '/feed/list', label: 'Lista', icon: '📋' },
] as const;

type MasEntry = { href: string; label: string; icon: string; desc: string };

/** Centro de control: pocas secciones con nombres accionables (no sinónimos ambiguos). */
const MAS_SECTIONS: { title: string; subtitle?: string; items: readonly MasEntry[] }[] = [
  {
    title: 'Potenciá la búsqueda',
    subtitle: 'IA, filtros clásicos y mapa',
    items: [
      {
        href: '/assistant',
        label: 'Asistente avanzado',
        icon: '🛠️',
        desc: 'Lenguaje natural y vista previa',
      },
      {
        href: '/search',
        label: 'Búsqueda por filtros',
        icon: '⚙️',
        desc: 'Tipo, precio, amenities y orden',
      },
      { href: '/search/map', label: 'Mapa', icon: '🗺️', desc: 'Ubicación en el mapa' },
    ],
  },
  {
    title: 'Tu biblioteca',
    subtitle: 'Lo que guardaste y reutilizás',
    items: [
      {
        href: '/me/saved',
        label: 'Guardados',
        icon: '⭐',
        desc: 'Me gusta, favoritos, listas y búsquedas',
      },
      {
        href: '/searches',
        label: 'Búsquedas guardadas',
        icon: '📁',
        desc: 'Activar, editar, alertas',
      },
    ],
  },
  {
    title: 'Seguimiento',
    subtitle: 'Alertas, mensajes y agenda',
    items: [
      { href: '/alerts', label: 'Alertas', icon: '🔔', desc: 'Novedades y bajas de precio' },
      { href: '/leads', label: 'Consultas', icon: '💬', desc: 'Inmobiliarias y respuestas' },
      { href: '/me/visits', label: 'Visitas', icon: '📅', desc: 'Visitas agendadas' },
    ],
  },
  {
    title: 'Cuenta',
    subtitle: 'Perfil y avisos',
    items: [
      {
        href: '/me/notifications',
        label: 'Notificaciones',
        icon: '📣',
        desc: 'Avisos en la app',
      },
      { href: '/me/profile', label: 'Perfil', icon: '👤', desc: 'Datos y preferencias' },
    ],
  },
] as const;

const ADMIN_MAS_ITEM: MasEntry = {
  href: '/me/settings',
  label: 'Configuración e integraciones',
  icon: '⚙️',
  desc: 'Admin: asistente IA, importadores, API, pagos',
};

function masSectionsForRole(
  role: string | null
): readonly { title: string; subtitle?: string; items: readonly MasEntry[] }[] {
  if (role !== 'ADMIN') return MAS_SECTIONS;
  return MAS_SECTIONS.map((section) =>
    section.title === 'Cuenta' ? { ...section, items: [...section.items, ADMIN_MAS_ITEM] } : section
  );
}

const NAV_LINK_CLASS =
  'flex items-center gap-3 px-3 py-3 rounded-[var(--mp-radius-chip)] text-[15px] font-medium transition-colors min-h-[44px]';

function navItemActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/feed') return pathname === '/feed' || pathname === '/feed/';
  if (href === '/feed/list') return pathname.startsWith('/feed/list');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none shadow-sm"
      aria-hidden
    >
      {label}
    </span>
  );
}

function MasMoreDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[var(--mp-card)]"
      aria-hidden
    />
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [masOpen, setMasOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshUnreadNotifications = useCallback(() => {
    fetch('/api/me/notifications/unread-count', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { count?: number } | null) => {
        if (d && typeof d.count === 'number') setUnreadNotifications(d.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const publicPath =
      pathname?.startsWith('/login') ||
      pathname?.startsWith('/join') ||
      pathname?.startsWith('/auth/') ||
      pathname === '/' ||
      pathname === '';
    if (publicPath) {
      setUserRole(null);
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    fetch('/api/me/profile', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const r = typeof d.role === 'string' ? d.role.toUpperCase() : null;
        setUserRole(r);
      })
      .catch(() => {
        if (!cancelled) setUserRole(null);
      });
    refreshUnreadNotifications();
    return () => {
      cancelled = true;
    };
  }, [pathname, refreshUnreadNotifications]);

  useEffect(() => {
    const onChanged = () => refreshUnreadNotifications();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    const onFocus = () => refreshUnreadNotifications();
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(refreshUnreadNotifications, 90000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [refreshUnreadNotifications]);

  const masSectionsResolved = useMemo(() => masSectionsForRole(userRole), [userRole]);
  const masFlatResolved = useMemo(
    () => masSectionsResolved.flatMap((s) => s.items),
    [masSectionsResolved]
  );

  const secondaryActive = masFlatResolved.some((item) => navItemActive(pathname, item.href));

  useEffect(() => {
    if (secondaryActive) setToolsOpen(true);
  }, [secondaryActive]);

  const isPublic =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/join') ||
    pathname?.startsWith('/auth/') ||
    pathname === '/';
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen h-screen flex overflow-hidden bg-[var(--mp-bg)]">
      <aside
        className={`hidden md:flex flex-col h-screen border-r border-[var(--mp-border)] bg-[var(--mp-card)] transition-all duration-300 shrink-0 overflow-hidden ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <div className="p-3 flex items-center justify-between border-b border-[var(--mp-border)] min-h-[52px] shrink-0">
          {sidebarOpen && (
            <Link
              href="/dashboard"
              className="font-bold text-lg text-[var(--mp-foreground)] truncate min-w-0"
            >
              MatchProp
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--mp-bg)] text-[var(--mp-muted)] shrink-0"
            aria-label={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_PRIMARY.map((item) => {
            const active = navItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${NAV_LINK_CLASS} min-w-0 ${
                  active
                    ? 'bg-[var(--mp-accent)] text-white'
                    : 'text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]'
                }`}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          {sidebarOpen && (
            <div className="pt-2 mt-2 border-t border-[var(--mp-border)]">
              <button
                type="button"
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`${NAV_LINK_CLASS} relative w-full min-w-0 text-left justify-between text-[var(--mp-muted)] hover:bg-[var(--mp-bg)] hover:text-[var(--mp-foreground)] ${
                  secondaryActive ? 'text-[var(--mp-accent-hover)] font-semibold' : ''
                }`}
                aria-expanded={toolsOpen}
              >
                <MasMoreDot show={unreadNotifications > 0} />
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">⋯</span>
                  <span className="truncate">Más</span>
                </span>
                <span className="text-xs shrink-0 opacity-70">{toolsOpen ? '▲' : '▼'}</span>
              </button>
              {toolsOpen && (
                <div className="mt-2 space-y-3 pl-1 ml-2 border-l-2 border-[var(--mp-border)]">
                  {masSectionsResolved.map((section) => (
                    <div key={section.title}>
                      <div className="px-3 py-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mp-muted)]">
                          {section.title}
                        </p>
                        {section.subtitle ? (
                          <p className="text-[10px] text-[var(--mp-muted)]/85 leading-snug mt-0.5">
                            {section.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const active = navItemActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`${NAV_LINK_CLASS} relative min-w-0 text-[14px] py-2.5 ${
                                active
                                  ? 'bg-[color-mix(in_srgb,var(--mp-accent)_14%,var(--mp-card))] text-[var(--mp-accent-hover)] font-semibold'
                                  : 'text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]'
                              }`}
                            >
                              <span className="text-base shrink-0">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                              {item.href === '/me/notifications' ? (
                                <UnreadBadge count={unreadNotifications} />
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!sidebarOpen &&
            masFlatResolved.map((item) => {
              const active = navItemActive(pathname, item.href);
              if (!active) return null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${NAV_LINK_CLASS} min-w-0 justify-center ${
                    active
                      ? 'bg-[color-mix(in_srgb,var(--mp-accent)_14%,var(--mp-card))] text-[var(--mp-accent-hover)]'
                      : ''
                  }`}
                  title={item.label}
                >
                  <span className="text-lg">{item.icon}</span>
                </Link>
              );
            })}
        </nav>
        <div className="p-2 border-t border-[var(--mp-border)] space-y-0.5 shrink-0">
          {userRole === 'ADMIN' && (
            <Link
              href="/me/settings"
              className={`${NAV_LINK_CLASS} min-w-0 text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]`}
            >
              <span className="text-lg shrink-0">⚙️</span>
              {sidebarOpen && <span className="truncate">Configuración</span>}
            </Link>
          )}
          <Link
            href="/me/premium"
            className={`${NAV_LINK_CLASS} min-w-0 bg-[var(--mp-premium)] text-slate-900 hover:opacity-90`}
          >
            <span className="text-lg shrink-0">⭐</span>
            {sidebarOpen && <span className="truncate">Premium</span>}
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className={`${NAV_LINK_CLASS} w-full min-w-0 text-left text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]`}
          >
            <span className="text-lg shrink-0">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarOpen && (
              <span className="truncate">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="md:hidden sticky top-0 z-20 shrink-0 bg-[var(--mp-card)] border-b border-[var(--mp-border)] px-4 py-2 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg text-[var(--mp-foreground)]">
            MatchProp
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/me/notifications"
              className="relative p-2 rounded-[var(--mp-radius-chip)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Notificaciones"
              aria-label={`Notificaciones${unreadNotifications > 0 ? ` (${unreadNotifications} sin leer)` : ''}`}
            >
              <span className="text-xl" aria-hidden>
                🔔
              </span>
              <UnreadBadge count={unreadNotifications} />
            </Link>
            {userRole === 'ADMIN' && (
              <Link
                href="/me/settings"
                className="p-2 rounded-[var(--mp-radius-chip)] text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Configuración e integraciones"
                aria-label="Configuración e integraciones"
              >
                ⚙️
              </Link>
            )}
            <Link
              href="/me/premium"
              className="px-2 py-1.5 rounded-[var(--mp-radius-chip)] bg-[var(--mp-premium)] text-slate-900 text-sm font-medium"
            >
              Premium
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-[var(--mp-radius-chip)] text-[var(--mp-muted)] hover:bg-[var(--mp-bg)]"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
          <div className="w-full max-w-2xl mx-auto px-4 md:px-6 py-4 min-h-full">{children}</div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--mp-card)] border-t border-[var(--mp-border)] safe-area-pb">
          <div className="flex justify-around items-center h-16 px-1">
            <NavLink href="/dashboard" icon="🔍" label="Buscar" pathname={pathname} />
            <NavLink href="/feed" icon="🎯" label="Match" pathname={pathname} />
            <NavLink href="/feed/list" icon="📋" label="Lista" pathname={pathname} />
            <NavLink href="/me/match" icon="🔥" label="Mis match" pathname={pathname} />
            <button
              type="button"
              onClick={() => setMasOpen(true)}
              className={`relative flex flex-col items-center justify-center flex-1 py-3 min-h-[52px] rounded-[var(--mp-radius-chip)] transition-colors active:scale-[0.98] ${
                masFlatResolved.some((m) => navItemActive(pathname, m.href))
                  ? 'text-[var(--mp-accent)] font-semibold'
                  : 'text-[var(--mp-muted)]'
              }`}
            >
              <MasMoreDot show={unreadNotifications > 0} />
              <span className="text-[1.25rem]">⋯</span>
              <span className="text-[13px]">Más</span>
            </button>
          </div>
        </nav>

        {masOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              aria-hidden
              onClick={() => setMasOpen(false)}
            />
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[78vh] rounded-t-[var(--mp-radius-card)] bg-[var(--mp-card)] border-t border-[var(--mp-border)] shadow-mp-md safe-area-pb overflow-y-auto">
              <div className="p-4 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--mp-foreground)]">
                      Centro de control
                    </h2>
                    <p className="text-xs text-[var(--mp-muted)]">
                      Búsqueda avanzada, biblioteca y seguimiento
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMasOpen(false)}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-full text-[var(--mp-muted)] hover:bg-[var(--mp-bg)] flex items-center justify-center"
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-5">
                  {masSectionsResolved.map((section) => (
                    <div key={section.title}>
                      <div className="mb-2 px-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mp-muted)]">
                          {section.title}
                        </p>
                        {section.subtitle ? (
                          <p className="text-[11px] text-[var(--mp-muted)] leading-snug mt-0.5">
                            {section.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const active = navItemActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMasOpen(false)}
                              className={`relative flex items-center gap-3 px-4 py-3 rounded-[var(--mp-radius-chip)] min-h-[52px] ${
                                active
                                  ? 'bg-[var(--mp-accent)] text-white'
                                  : 'text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]'
                              }`}
                            >
                              <span className="text-xl shrink-0">{item.icon}</span>
                              <div className="min-w-0 flex-1">
                                <span className="font-medium block">{item.label}</span>
                                <span
                                  className={`text-xs block truncate ${active ? 'text-white/80' : 'text-[var(--mp-muted)]'}`}
                                >
                                  {item.desc}
                                </span>
                              </div>
                              {item.href === '/me/notifications' && unreadNotifications > 0 ? (
                                <span className="shrink-0 min-w-[1.25rem] h-6 px-1.5 flex items-center justify-center rounded-full bg-white/25 text-xs font-bold">
                                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  pathname,
}: {
  href: string;
  icon: string;
  label: string;
  pathname: string | null;
}) {
  const active = navItemActive(pathname, href);
  return (
    <Link
      href={href}
      title={label}
      className={`flex flex-col items-center justify-center flex-1 py-2 min-h-[52px] rounded-[var(--mp-radius-chip)] transition-colors active:scale-[0.98] ${
        active ? 'text-[var(--mp-accent)] font-semibold' : 'text-[var(--mp-muted)]'
      }`}
    >
      <span className="text-[1.25rem]">{icon}</span>
      <span className="text-[10px] sm:text-[11px] leading-tight text-center px-0.5 max-w-[4.25rem] truncate">
        {label}
      </span>
    </Link>
  );
}
