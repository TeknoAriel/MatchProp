'use client';

export type ListingMediaViewItem = {
  url: string;
  type?: string | null;
};

export type MediaDisplayKind = 'PHOTO' | 'VIDEO_FILE' | 'VIDEO_EMBED';

export function inferClientMediaKind(url: string, explicit?: string | null): MediaDisplayKind {
  const t = (explicit ?? '').toUpperCase();
  if (t === 'VIDEO') {
    const embed = toVideoEmbedUrl(url);
    return embed ? 'VIDEO_EMBED' : 'VIDEO_FILE';
  }
  if (t === 'PHOTO') return 'PHOTO';
  const u = url.trim().toLowerCase();
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u)) return 'VIDEO_FILE';
  if (
    u.includes('youtube.com') ||
    u.includes('youtu.be') ||
    u.includes('vimeo.com') ||
    u.includes('player.vimeo.com')
  )
    return 'VIDEO_EMBED';
  return 'PHOTO';
}

export function toVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
      const s = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (s?.[1]) return `https://www.youtube.com/embed/${s[1]}`;
    }
    if (host.includes('vimeo.com') && !host.includes('player.')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

type ListingMediaViewProps = {
  item: ListingMediaViewItem;
  alt: string;
  className?: string;
  /** Para `<video>` / iframe: ocupa el contenedor */
  fitClassName?: string;
  onImageError?: () => void;
  onVideoError?: () => void;
};

/**
 * Una slide de galería: foto, archivo de video o embed (YouTube/Vimeo).
 */
export default function ListingMediaView({
  item,
  alt,
  className = 'w-full h-full object-cover',
  fitClassName = 'absolute inset-0 w-full h-full',
  onImageError,
  onVideoError,
}: ListingMediaViewProps) {
  const kind = inferClientMediaKind(item.url, item.type);
  const embedSrc = kind === 'VIDEO_EMBED' ? toVideoEmbedUrl(item.url) : null;

  if (kind === 'VIDEO_EMBED' && embedSrc) {
    return (
      <iframe
        title={alt ? `Video: ${alt}` : 'Video de la propiedad'}
        src={embedSrc}
        className={`${fitClassName} border-0 bg-black`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  if (kind === 'VIDEO_FILE') {
    return (
      <video
        key={item.url}
        className={className}
        controls
        muted
        playsInline
        preload="metadata"
        src={item.url}
        onError={onVideoError}
      />
    );
  }

  return (
    <img src={item.url} alt={alt} className={className} loading="lazy" onError={onImageError} />
  );
}
