/** Tipo persistido en ListingMedia.type */
export type ListingMediaType = 'PHOTO' | 'VIDEO';

export function inferMediaTypeFromUrl(url: string): ListingMediaType {
  const u = url.trim().toLowerCase();
  if (!u) return 'PHOTO';
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u)) return 'VIDEO';
  if (
    u.includes('youtube.com') ||
    u.includes('youtu.be') ||
    u.includes('vimeo.com') ||
    u.includes('player.vimeo.com')
  )
    return 'VIDEO';
  return 'PHOTO';
}

export function resolveMediaType(url: string, explicit?: string | null): ListingMediaType {
  const e = (explicit ?? '').toUpperCase();
  if (e === 'VIDEO' || e === 'PHOTO') return e;
  return inferMediaTypeFromUrl(url);
}

/** URL para hero: preferir primera foto para previews `<img>`. */
export function pickHeroUrlFromMedia(
  items: { url: string; type?: string | null }[]
): string | null {
  if (!items.length) return null;
  const firstPhoto = items.find((m) => resolveMediaType(m.url, m.type) === 'PHOTO');
  return (firstPhoto ?? items[0])?.url ?? null;
}
