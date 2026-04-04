'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Vista "Listado": alternar entre deck (Match) y tabla (Lista); mismo origen de datos (GET /feed).
 */
export function FeedNavTabs() {
  const pathname = usePathname();
  const isDeck = pathname === '/feed' || pathname === '/feed/';
  const isList = pathname?.startsWith('/feed/list');

  const pill =
    'flex-1 text-center py-2.5 px-3 rounded-[var(--mp-radius-chip)] text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center';
  const active = 'bg-[var(--mp-accent)] text-white';
  const idle = 'bg-[var(--mp-bg)] text-[var(--mp-foreground)] hover:opacity-90';

  return (
    <div
      className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 mb-3 pt-1"
      role="navigation"
      aria-label="Vista del listado"
    >
      <div className="flex gap-2 p-1 rounded-[var(--mp-radius-card)] bg-[var(--mp-card)] border border-[var(--mp-border)] shadow-sm">
        <Link href="/feed" className={`${pill} ${isDeck ? active : idle}`} prefetch>
          Ver en match
        </Link>
        <Link href="/feed/list" className={`${pill} ${isList ? active : idle}`} prefetch>
          Ver en lista
        </Link>
      </div>
    </div>
  );
}
