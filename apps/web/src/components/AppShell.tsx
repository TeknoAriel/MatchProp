'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/feed', label: 'Match', icon: '🔥' },
  { href: '/feed/list', label: 'Lista', icon: '📋' },
  { href: '/search/map', label: 'Mapa', icon: '🗺️' },
  { href: '/me/saved', label: 'Favoritos', icon: '⭐' },
  { href: '/searches', label: 'Búsquedas', icon: '📁' },
  { href: '/alerts', label: 'Alertas', icon: '🔔' },
  { href: '/leads', label: 'Consultas', icon: '💬' },
  { href: '/me/profile', label: 'Perfil', icon: '👤' },
];

/** Items que en móvil van dentro del menú "Más" */
const MAS_ITEMS = [
  { href: '/search/map', label: 'Ver en mapa', icon: '🗺️', desc: 'Propiedades con ubicación' },
  { href: '/searches', label: 'Mis búsquedas', icon: '📁', desc: 'Búsquedas guardadas' },
  { href: '/alerts', label: 'Alertas', icon: '🔔', desc: 'Avisos de nuevas propiedades' },
  { href: '/leads', label: 'Consultas', icon: '💬', desc: 'Contactos con inmobiliarias' },
  { href: '/me/profile', label: 'Mi perfil', icon: '👤', desc: 'Datos y preferencias' },
];

/** Tap target mínimo 44px para accesibilidad (25–70 años) */
const NAV_LINK_CLASS =
  'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors min-h-[44px]';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [masOpen, setMasOpen] = useState(false);

  const isPublic =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/join') ||
    pathname?.startsWith('/auth/') ||
    pathname === '/';
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen h-screen flex overflow-hidden bg-[var(--mp-bg)]">
      {/* Sidebar Desktop - colapsable, scroll interno, fijo en viewport */}
      <aside
        className={`hidden md:flex flex-col h-screen border-r border-[var(--mp-border)] bg-[var(--mp-card)] transition-all duration-300 shrink-0 overflow-hidden ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <div className="p-3 flex items-center justify-between border-b border-[var(--mp-border)] min-h-[52px] shrink-0">
          {sidebarOpen && (
            <Link
              href="/feed"
              className="font-bold text-lg text-[var(--mp-foreground)] truncate min-w-0"
            >
              MatchProp
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--mp-bg)] text-[var(--mp-muted)] shrink-0"
            aria-label={sidebarOpen ? 'Colapsar' : 'Expandir'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
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
        </nav>
        <div className="p-2 border-t border-[var(--mp-border)] space-y-0.5 shrink-0">
          <Link
            href="/me/settings"
            className={`${NAV_LINK_CLASS} min-w-0 text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]`}
          >
            <span className="text-lg shrink-0">⚙️</span>
            {sidebarOpen && <span className="truncate">Configuración</span>}
          </Link>
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

      {/* Main content - overflow scroll para que no se vaya de página */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="md:hidden sticky top-0 z-20 shrink-0 bg-[var(--mp-card)] border-b border-[var(--mp-border)] px-4 py-2 flex items-center justify-between">
          <Link href="/feed" className="font-bold text-lg text-[var(--mp-foreground)]">
            MatchProp
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/me/premium"
              className="px-2 py-1.5 rounded-lg bg-[var(--mp-premium)] text-slate-900 text-sm font-medium"
            >
              Premium
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--mp-muted)]"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Contenedor principal - scroll interno para contenido largo */}
        <main className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
          <div className="w-full max-w-2xl mx-auto px-4 md:px-6 py-4 min-h-full">{children}</div>
        </main>

        {/* Bottom Nav - Mobile only: Inicio, Match, Lista, Favoritos, Más */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--mp-card)] border-t border-[var(--mp-border)] safe-area-pb">
          <div className="flex justify-around items-center h-16 px-1">
            <NavLink href="/dashboard" icon="🏠" label="Inicio" pathname={pathname} />
            <NavLink href="/feed" icon="🔥" label="Match" pathname={pathname} />
            <NavLink href="/feed/list" icon="📋" label="Lista" pathname={pathname} />
            <NavLink href="/me/saved" icon="⭐" label="Favoritos" pathname={pathname} />
            <button
              type="button"
              onClick={() => setMasOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 py-3 min-h-[52px] rounded-xl transition-colors active:scale-[0.98] ${
                MAS_ITEMS.some((m) => pathname === m.href || pathname?.startsWith(m.href + '/'))
                  ? 'text-[var(--mp-accent)] font-semibold'
                  : 'text-[var(--mp-muted)]'
              }`}
            >
              <span className="text-[1.25rem]">⋯</span>
              <span className="text-[13px]">Más</span>
            </button>
          </div>
        </nav>

        {/* Sheet "Más" - Alertas, Búsquedas, Consultas (masterplan E5) */}
        {masOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              aria-hidden
              onClick={() => setMasOpen(false)}
            />
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl bg-[var(--mp-card)] border-t border-[var(--mp-border)] shadow-lg safe-area-pb">
              <div className="p-4 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--mp-foreground)]">Más</h2>
                    <p className="text-xs text-[var(--mp-muted)]">Consultas, alertas y búsquedas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMasOpen(false)}
                    className="p-2 rounded-full text-[var(--mp-muted)] hover:bg-[var(--mp-bg)]"
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-0.5">
                  {MAS_ITEMS.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMasOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-[52px] ${
                          active
                            ? 'bg-[var(--mp-accent)] text-white'
                            : 'text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]'
                        }`}
                      >
                        <span className="text-xl shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <span className="font-medium block">{item.label}</span>
                          {'desc' in item && (
                            <span
                              className={`text-xs block truncate ${active ? 'text-white/80' : 'text-[var(--mp-muted)]'}`}
                            >
                              {(item as { desc?: string }).desc}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
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
  const active = pathname === href || pathname?.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center flex-1 py-3 min-h-[52px] rounded-xl transition-colors active:scale-[0.98] ${
        active ? 'text-[var(--mp-accent)] font-semibold' : 'text-[var(--mp-muted)]'
      }`}
    >
      <span className="text-[1.25rem]">{icon}</span>
      <span className="text-[13px]">{label}</span>
    </Link>
  );
}
