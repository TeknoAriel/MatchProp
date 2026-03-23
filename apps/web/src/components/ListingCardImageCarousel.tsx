'use client';

import { useState, useEffect, useMemo } from 'react';
import { buildListingImageSlides } from '../lib/listing-images';

export interface CardMedia {
  url: string;
  sortOrder?: number;
}

interface ListingCardImageCarouselProps {
  heroImageUrl?: string | null;
  media?: CardMedia[];
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  /**
   * Clases para los botones prev/next.
   * Por defecto: siempre visibles (touch móvil); en desktop más discretos hasta hover.
   */
  carouselButtonClass?: string;
}

/** Carrusel de imágenes para cards de propiedades. Muestra flechas y dots cuando hay múltiples fotos. */
export default function ListingCardImageCarousel({
  heroImageUrl,
  media,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200',
  carouselButtonClass = 'opacity-100 shadow-md',
}: ListingCardImageCarouselProps) {
  const [imgError, setImgError] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const slideKey = useMemo(
    () =>
      `${heroImageUrl ?? ''}|${(media ?? [])
        .map((m) => `${m.url}:${m.sortOrder ?? 0}`)
        .join('|')}`,
    [heroImageUrl, media]
  );

  const images = buildListingImageSlides(heroImageUrl, media);

  useEffect(() => {
    setImageIndex(0);
    setImgError(false);
  }, [slideKey]);

  const currentImage = images[imageIndex];
  const hasMultiple = images.length > 1;
  const showImage = !!currentImage?.url && !imgError;

  if (!currentImage) {
    return (
      <div className={fallbackClassName}>
        <span className="text-3xl mb-1">🏠</span>
        <span className="text-xs">Sin imagen</span>
      </div>
    );
  }

  return (
    <>
      {showImage ? (
        <img
          src={currentImage.url}
          alt={alt}
          className={className}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={fallbackClassName}>
          <span className="text-3xl mb-1">🏠</span>
          <span className="text-xs">Sin imagen</span>
        </div>
      )}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setImgError(false);
              setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
            }}
            className={`absolute left-2 top-1/2 z-[1] -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white ${carouselButtonClass}`}
            aria-label="Imagen anterior"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setImgError(false);
              setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
            }}
            className={`absolute right-2 top-1/2 z-[1] -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white ${carouselButtonClass}`}
            aria-label="Siguiente imagen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImgError(false);
                  setImageIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${idx === imageIndex ? 'bg-white scale-125' : 'bg-white/60 hover:bg-white/80'}`}
                aria-label={`Ir a imagen ${idx + 1}`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-full font-medium">
            📷 {imageIndex + 1}/{images.length}
          </span>
        </>
      )}
    </>
  );
}
