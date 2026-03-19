'use client';

import { useState } from 'react';

interface ListingImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIcon?: string;
  fallbackText?: string;
}

export default function ListingImage({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200',
  fallbackIcon = '🏠',
  fallbackText = 'Sin imagen',
}: ListingImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={fallbackClassName}>
        <span className="text-3xl mb-1">{fallbackIcon}</span>
        <span className="text-xs">{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

