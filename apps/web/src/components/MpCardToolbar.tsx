'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

/** Botonera compacta unificada (alertas, búsquedas, consultas, listas) */
export const mpToolbarBtnBase =
  'inline-flex items-center justify-center gap-1 min-h-[32px] px-2 py-1 rounded-[var(--mp-radius-chip)] text-[11px] font-semibold border border-[var(--mp-border)] leading-tight transition-colors disabled:opacity-50 shrink-0';

const toolbarVariants: Record<string, string> = {
  default:
    'bg-[var(--mp-card)] text-[var(--mp-foreground)] border-[var(--mp-border)] hover:bg-[var(--mp-bg)]',
  primary: 'bg-[var(--mp-accent)] text-white border-[var(--mp-accent-hover)] hover:opacity-[0.96]',
  danger:
    'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800',
  muted:
    'bg-[var(--mp-bg)] text-[var(--mp-muted)] border-[var(--mp-border)] hover:text-[var(--mp-foreground)]',
};

export function ToolbarBtn({
  icon,
  label,
  className,
  variant = 'default',
  ...props
}: {
  icon: string;
  label?: string;
  className?: string;
  variant?: keyof typeof toolbarVariants;
} & ComponentProps<'button'>) {
  const v = toolbarVariants[variant] ?? toolbarVariants.default;
  return (
    <button type="button" className={`${mpToolbarBtnBase} ${v} ${className ?? ''}`} {...props}>
      <span className="text-sm leading-none" aria-hidden>
        {icon}
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function ToolbarLink({
  icon,
  label,
  className,
  href,
  variant = 'default',
}: {
  icon: string;
  label: string;
  className?: string;
  href: string;
  variant?: keyof typeof toolbarVariants;
}) {
  const v = toolbarVariants[variant] ?? toolbarVariants.default;
  return (
    <Link href={href} className={`${mpToolbarBtnBase} ${v} ${className ?? ''}`}>
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
