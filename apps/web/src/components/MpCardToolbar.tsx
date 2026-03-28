'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

/** Misma botonera compacta que Alertas (≈34px alto, icono + texto corto) */
export const mpToolbarBtnBase =
  'inline-flex items-center justify-center gap-1 min-h-[32px] px-2 py-1 rounded-[var(--mp-radius-chip)] text-[11px] font-semibold border border-[var(--mp-border)] leading-tight transition-colors disabled:opacity-50 shrink-0';

export function ToolbarBtn({
  icon,
  label,
  className,
  ...props
}: { icon: string; label: string; className?: string } & ComponentProps<'button'>) {
  return (
    <button type="button" className={`${mpToolbarBtnBase} ${className ?? ''}`} {...props}>
      <span className="text-sm leading-none" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function ToolbarLink({
  icon,
  label,
  className,
  href,
}: {
  icon: string;
  label: string;
  className?: string;
  href: string;
}) {
  return (
    <Link href={href} className={`${mpToolbarBtnBase} ${className ?? ''}`}>
      <span className="text-sm leading-none" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function CardToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mp-toolbar px-2.5 py-2">
      <div className="flex flex-wrap gap-1.5 items-stretch">{children}</div>
    </div>
  );
}

/** Misma fila de chips sin borde superior (cabeceras de página) */
export function ToolbarRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 items-stretch ${className}`.trim()}>{children}</div>
  );
}
