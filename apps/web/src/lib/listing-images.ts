/**
 * Construye la lista de fotos para carruseles a partir de hero + media del API.
 * Filtra URLs vacías y ordena por sortOrder.
 */
export function buildListingImageSlides(
  heroImageUrl: string | null | undefined,
  media?: { url: string; sortOrder?: number }[] | null
): { url: string; sortOrder: number }[] {
  const fromMedia = media?.length
    ? [...media]
        .map((m, i) => ({
          url: typeof m?.url === 'string' ? m.url.trim() : '',
          sortOrder: typeof m?.sortOrder === 'number' ? m.sortOrder : i,
        }))
        .filter((m) => m.url.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  if (fromMedia.length > 0) return fromMedia;

  const h = typeof heroImageUrl === 'string' ? heroImageUrl.trim() : '';
  return h ? [{ url: h, sortOrder: 0 }] : [];
}

/** Parsea el array `media` tal como viene del API (feed, listings, saved). */
export function parseListingMediaFromApi(
  raw: unknown
): { url: string; sortOrder: number }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { url: string; sortOrder: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i];
    if (!m || typeof m !== 'object') continue;
    const mm = m as Record<string, unknown>;
    const url = typeof mm.url === 'string' && mm.url.trim() ? mm.url.trim() : null;
    if (!url) continue;
    const sortOrder = typeof mm.sortOrder === 'number' ? mm.sortOrder : i;
    out.push({ url, sortOrder });
  }
  return out.length ? out.sort((a, b) => a.sortOrder - b.sortOrder) : undefined;
}
