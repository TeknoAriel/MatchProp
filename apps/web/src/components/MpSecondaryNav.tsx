'use client';

import Link from 'next/link';

export type SecondaryNavItem = { href: string; label: string; icon?: string };

/** Navegación secundaria unificada (mismo estilo que la botonera mp) */
export function MpSecondaryNav({
  items,
  pathname,
  className = '',
}: {
  items: SecondaryNavItem[];
  pathname: string | null;
  className?: string;
}) {
  return (
    <nav
      className={`flex flex-wrap gap-1.5 mb-4 ${className}`.trim()}
      aria-label="Navegación de sección"
    >
      {items.map((it) => {
        const active = (() => {
          if (!pathname) return false;
          if (it.href === '/dashboard') {
            return pathname === '/dashboard' || pathname === '/dashboard/';
          }
          if (it.href === '/feed') {
            return pathname === '/feed' || pathname === '/feed/';
          }
          if (it.href === '/feed/list') {
            return pathname.startsWith('/feed/list');
          }
          return pathname === it.href || (it.href !== '/' && pathname.startsWith(`${it.href}/`));
        })();
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 rounded-[var(--mp-radius-chip)] text-[12px] font-semibold border transition-colors ${
              active
                ? 'bg-[var(--mp-accent)] text-white border-[var(--mp-accent-hover)] shadow-sm'
                : 'bg-[var(--mp-card)] text-[var(--mp-foreground)] border-[var(--mp-border)] hover:border-[var(--mp-accent)]/35'
            }`}
          >
            {it.icon ? (
              <span className="text-sm leading-none" aria-hidden>
                {it.icon}
              </span>
            ) : null}
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Solo el núcleo del flujo (v3.2). Búsquedas, alertas y consultas → menú “Más” / sidebar.
 */
export const SECONDARY_NAV_HUB: SecondaryNavItem[] = [
  { href: '/dashboard', label: 'Buscar', icon: '🔍' },
  { href: '/feed', label: 'Match', icon: '🎯' },
  { href: '/feed/list', label: 'Lista', icon: '📋' },
];

/** Desde consultas: mismo núcleo + Mis match */
export const SECONDARY_NAV_LEADS: SecondaryNavItem[] = [
  { href: '/dashboard', label: 'Buscar', icon: '🔍' },
  { href: '/feed', label: 'Match', icon: '🎯' },
  { href: '/feed/list', label: 'Lista', icon: '📋' },
  { href: '/me/match', label: 'Mis match', icon: '🔥' },
];
