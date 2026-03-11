'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ActiveSearchBar from './ActiveSearchBar';
import { useTheme } from './ThemeProvider';

const NAV_ITEMS = [
  { href: '/feed', label: 'Match', icon: '🔥' },
  { href: '/feed/list', label: 'Lista', icon: '📋' },
  { href: '/assistant', label: 'Buscar', icon: '🔍' },
  { href: '/me/saved', label: 'Favoritos', icon: '★' },
  { href: '/alerts', label: 'Alertas', icon: '🔔' },
  { href: '/searches', label: 'Búsquedas', icon: '📁' },
  { href: '/leads', label: 'Consultas', icon: '💬' },
  { href: '/me/profile', label: 'Perfil', icon: '👤' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isPublic =
    pathname?.startsWith('/login') || pathname?.startsWith('/join') || pathname === '/';
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen flex bg-[var(--mp-bg)]">
      {/* Sidebar Desktop - colapsable */}
      <aside
        className={`hidden md:flex flex-col border-r border-[var(--mp-border)] bg-[var(--mp-card)] transition-all duration-300 ${
          sidebarOpen ? 'w-56' : 'w-16'
        }`}
      >
        <div className="p-3 flex items-center justify-between border-b border-[var(--mp-border)]">
          {sidebarOpen && (
            <Link href="/feed" className="font-bold text-lg text-[var(--mp-foreground)]">
              MatchProp
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--mp-bg)] text-[var(--mp-muted)]"
            aria-label={sidebarOpen ? 'Colapsar' : 'Expandir'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--mp-accent)] text-white'
                    : 'text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]'
                }`}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-[var(--mp-border)] space-y-1">
          <Link
            href="/me/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
          >
            <span className="text-lg">⚙️</span>
            {sidebarOpen && <span>Configuraciones</span>}
          </Link>
          <Link
            href="/me/premium"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-[var(--mp-premium)] text-slate-900 hover:opacity-90"
          >
            <span className="text-lg">⭐</span>
            {sidebarOpen && <span>Premium</span>}
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--mp-foreground)] hover:bg-[var(--mp-bg)]"
          >
            <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="md:hidden sticky top-0 z-20 bg-[var(--mp-card)] border-b border-[var(--mp-border)] px-4 py-2 flex items-center justify-between">
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

        <ActiveSearchBar />
        <main className="flex-1 min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-80px)] pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom Nav - Mobile only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--mp-card)] border-t border-[var(--mp-border)] safe-area-pb">
          <div className="flex justify-around items-center h-16 px-2">
            <NavLink href="/feed" icon="🔥" label="Match" pathname={pathname} />
            <NavLink href="/feed/list" icon="📋" label="Lista" pathname={pathname} />
            <NavLink href="/assistant" icon="🔍" label="Buscar" pathname={pathname} />
            <NavLink href="/me/saved" icon="★" label="Favoritos" pathname={pathname} />
            <NavLink href="/me/profile" icon="👤" label="Perfil" pathname={pathname} />
          </div>
        </nav>
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
      className={`flex flex-col items-center justify-center flex-1 py-2 min-h-[48px] rounded-lg transition-colors ${
        active ? 'text-[var(--mp-accent)] font-medium' : 'text-[var(--mp-muted)]'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}
