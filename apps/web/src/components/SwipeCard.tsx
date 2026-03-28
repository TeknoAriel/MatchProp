'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import type { ListingCard } from '@matchprop/shared';
import ListingCardImageCarousel from './ListingCardImageCarousel';

const SWIPE_THRESHOLD_PX = 72;

interface SwipeCardProps {
  card: ListingCard;
  onClick?: () => void;
  /** Si tiene score alto, mostrar link a Investor Mode */
  showInvestorLink?: boolean;
  /** Deslizar izquierda = descartar, derecha = me interesa (estilo Tinder) */
  swipeActions?: {
    onLeft: () => void;
    onRight: () => void;
    disabled?: boolean;
  };
}

export default function SwipeCard({
  card,
  onClick,
  showInvestorLink,
  swipeActions,
}: SwipeCardProps) {
  const priceText =
    card.price != null ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}` : 'Consultar';
  const zoneText = card.locationText ?? (card.bedrooms != null ? `${card.bedrooms} amb` : '');

  const [dragDx, setDragDx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const swipeEnabled = Boolean(swipeActions && !swipeActions.disabled);

  const clearDrag = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    setDragDx(0);
    startXRef.current = null;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return;
    draggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!swipeEnabled || !draggingRef.current || startXRef.current == null) return;
    setDragDx(e.clientX - startXRef.current);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!swipeEnabled) return;
    const start = startXRef.current;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (draggingRef.current && start != null) {
      const delta = e.clientX - start;
      if (delta <= -SWIPE_THRESHOLD_PX) {
        suppressClickRef.current = true;
        swipeActions!.onLeft();
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 320);
      } else if (delta >= SWIPE_THRESHOLD_PX) {
        suppressClickRef.current = true;
        swipeActions!.onRight();
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 320);
      }
    }
    clearDrag();
  };

  const onPointerCancel = () => {
    clearDrag();
  };

  const handleRootClick = () => {
    if (suppressClickRef.current) return;
    onClick?.();
  };

  const handleRootKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRootClick();
  };

  return (
    <div className="relative">
      {swipeEnabled && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex justify-between items-center px-4 text-[11px] font-bold uppercase tracking-wide"
          aria-hidden
        >
          <span
            className={`rounded-full px-2 py-1 border border-rose-300/80 bg-rose-500/15 text-rose-700 transition-opacity ${
              dragDx < -16 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Descartar
          </span>
          <span
            className={`rounded-full px-2 py-1 border border-emerald-400/80 bg-emerald-500/15 text-emerald-800 transition-opacity ${
              dragDx > 16 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Me interesa
          </span>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRootClick}
        onKeyDown={handleRootKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          transform:
            dragDx !== 0 ? `translateX(${dragDx}px) rotate(${dragDx * 0.035}deg)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: swipeEnabled ? 'none' : undefined,
        }}
        className="card-base overflow-hidden card-hover cursor-pointer select-none"
      >
        {/* Imagen dominante con gradiente inferior (Tinder style) */}
        <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 group">
          <ListingCardImageCarousel
            heroImageUrl={card.heroImageUrl}
            media={card.media}
            alt={card.title ?? ''}
            carouselButtonClass="opacity-0 group-hover:opacity-100 transition-opacity"
          />
          <div
            className="absolute inset-0 mp-card-gradient pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
            <p className="text-xl font-bold">{priceText}</p>
            <p className="text-sm text-white/90 truncate">{zoneText}</p>
          </div>
          {showInvestorLink && (
            <Link
              href={`/listing/${card.id}?mode=investor`}
              className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-[var(--mp-premium)] text-slate-900 text-xs font-medium hover:opacity-90"
              onClick={(e) => e.stopPropagation()}
            >
              Score →
            </Link>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-semibold text-lg truncate text-[var(--mp-foreground)]">
            {card.title ?? 'Sin título'}
          </h2>
          {!card.heroImageUrl && !card.media?.length && (
            <p className="text-sm text-[var(--mp-muted)] truncate mt-0.5">
              {priceText} · {zoneText}
            </p>
          )}
          {swipeEnabled && (
            <p className="text-xs text-[var(--mp-muted)] mt-2">
              Deslizá: izq. descartar · der. me interesa
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
