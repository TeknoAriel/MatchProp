'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isListingVideoMedia } from '../lib/listing-media-display';

export interface CardMedia {
  url: string;
  sortOrder?: number;
  type?: string | null;
}

interface ListingCardImageCarouselProps {
  heroImageUrl?: string | null;
  media?: CardMedia[];
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  carouselButtonClass?: string;
  controlsAlwaysVisible?: boolean;
}

function MediaSlide({
  url,
  alt,
  isVideo,
  imgClassName,
  compactFallbackClass,
}: {
  url: string;
  alt: string;
  isVideo: boolean;
  imgClassName: string;
  compactFallbackClass: string;
}) {
  const [broken, setBroken] = useState(false);
  if (isVideo) {
    return (
      <video
        src={url}
        className={imgClassName}
        controls
        muted
        playsInline
        preload="metadata"
        aria-label={alt ? `Video: ${alt}` : 'Video de la propiedad'}
      />
    );
  }
  if (broken) {
    return (
      <div
        className={`${imgClassName} ${compactFallbackClass} flex flex-col items-center justify-center`}
      >
        <span className="text-2xl mb-1">🏠</span>
        <span className="text-[10px]">Sin vista</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={imgClassName}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

/** Carrusel horizontal (scroll-snap + flechas) para cards; soporta VIDEO por type o URL. */
export default function ListingCardImageCarousel({
  heroImageUrl,
  media,
  alt = '',
  className = 'absolute inset-0 w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200',
  carouselButtonClass = 'opacity-0 group-hover:opacity-100 transition-opacity',
  controlsAlwaysVisible = false,
}: ListingCardImageCarouselProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const slides: { url: string; sortOrder: number; type?: string | null }[] = media?.length
    ? [...media]
        .map((m, i) => ({
          url: m.url,
          sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : i,
          type: m.type,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : heroImageUrl
      ? [{ url: heroImageUrl, sortOrder: 0 }]
      : [];

  const slidesKey = slides.map((s) => s.url).join('|');
  const hasMultiple = slides.length > 1;
  const btnClass = controlsAlwaysVisible && hasMultiple ? 'opacity-95' : carouselButtonClass;

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      if (!el || !hasMultiple) return;
      const len = slides.length;
      const next = ((i % len) + len) % len;
      const w = el.clientWidth;
      el.scrollTo({ left: next * w, behavior: 'smooth' });
      setSlideIndex(next);
    },
    [hasMultiple, slides.length]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !hasMultiple) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const i = Math.round(el.scrollLeft / w);
      setSlideIndex(Math.max(0, Math.min(i, slides.length - 1)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMultiple, slides.length]);

  useEffect(() => {
    setSlideIndex(0);
    if (scrollerRef.current) scrollerRef.current.scrollTo({ left: 0 });
  }, [slidesKey]);

  if (slides.length === 0) {
    return (
      <div className={fallbackClassName}>
        <span className="text-3xl mb-1">🏠</span>
        <span className="text-xs">Sin imagen</span>
      </div>
    );
  }

  if (!hasMultiple) {
    const first = slides[0]!;
    const video = isListingVideoMedia(first.type, first.url);
    return (
      <MediaSlide
        url={first.url}
        alt={alt}
        isVideo={video}
        imgClassName={className}
        compactFallbackClass="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400"
      />
    );
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-x' }}
        aria-roledescription="carrusel"
        aria-label={alt ? `Fotos de ${alt}` : 'Fotos de la propiedad'}
      >
        {slides.map((slide, i) => {
          const video = isListingVideoMedia(slide.type, slide.url);
          return (
            <div
              key={`${slide.url}-${i}`}
              className="min-w-full h-full snap-center snap-always shrink-0 relative"
            >
              <MediaSlide
                url={slide.url}
                alt={alt}
                isVideo={video}
                imgClassName={className}
                compactFallbackClass="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400"
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          scrollToIndex(slideIndex - 1);
        }}
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md ${btnClass}`}
        aria-label="Imagen anterior"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          scrollToIndex(slideIndex + 1);
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white shadow-md ${btnClass}`}
        aria-label="Siguiente imagen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              scrollToIndex(idx);
            }}
            className={`w-2 h-2 rounded-full transition-all ${idx === slideIndex ? 'bg-white scale-125' : 'bg-white/60 hover:bg-white/80'}`}
            aria-label={`Ir a imagen ${idx + 1}`}
          />
        ))}
      </div>
      <span className="absolute top-2 right-2 z-10 text-xs bg-black/60 text-white px-2 py-1 rounded-full font-medium">
        {isListingVideoMedia(slides[slideIndex]?.type, slides[slideIndex]?.url) ? '🎬' : '📷'}{' '}
        {slideIndex + 1}/{slides.length}
      </span>
    </>
  );
}
