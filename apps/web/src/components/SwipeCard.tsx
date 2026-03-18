'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ListingCard } from '@matchprop/shared';

interface SwipeCardProps {
  card: ListingCard;
  onClick?: () => void;
  /** Si tiene score alto, mostrar link a Investor Mode */
  showInvestorLink?: boolean;
}

export default function SwipeCard({ card, onClick, showInvestorLink }: SwipeCardProps) {
  const [imgError, setImgError] = useState(false);
  const priceText =
    card.price != null ? `${card.currency ?? 'USD'} ${card.price.toLocaleString()}` : 'Consultar';
  const zoneText = card.locationText ?? (card.bedrooms != null ? `${card.bedrooms} amb` : '');
  const showImage = card.heroImageUrl && !imgError;

  return (
    <div
      className="card-base overflow-hidden card-hover cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Imagen dominante con gradiente inferior (Tinder style) */}
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {showImage ? (
          <>
            <img
              src={card.heroImageUrl!}
              alt={card.title ?? ''}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
            {/* Gradiente donde vive precio y zona */}
            <div
              className="absolute inset-0 mp-card-gradient"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <p className="text-xl font-bold">{priceText}</p>
              <p className="text-sm text-white/90 truncate">{zoneText}</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-5xl mb-3">🏠</span>
            <p className="text-xl font-bold text-slate-700">{priceText}</p>
            <p className="text-sm text-slate-500">{zoneText}</p>
          </div>
        )}
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
        {!showImage && (
          <p className="text-sm text-[var(--mp-muted)] truncate mt-0.5">
            {priceText} · {zoneText}
          </p>
        )}
      </div>
    </div>
  );
}
