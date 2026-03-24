/**
 * Extrae imagen y título desde rawJson cuando heroImageUrl/title están vacíos.
 * Soporta formatos de Kiteprop (photos, imagenes), Toctoc (fotos), Zonaprop, etc.
 */
export function extractFromRawJson(raw: unknown): {
  heroImageUrl: string | null;
  title: string | null;
  mediaUrls: { url: string; sortOrder: number }[];
} {
  if (!raw || typeof raw !== 'object') {
    return { heroImageUrl: null, title: null, mediaUrls: [] };
  }
  const r = raw as Record<string, unknown>;

  // Título
  const title =
    (typeof r.title === 'string' && r.title.trim()) ||
    (typeof r.titulo === 'string' && r.titulo.trim()) ||
    null;

  // Imágenes: múltiples formatos conocidos
  let mediaUrls: { url: string; sortOrder: number }[] = [];

  // photos: ["url1", "url2"] (Kiteprop)
  const photos = Array.isArray(r.photos) ? r.photos : [];
  if (photos.length) {
    mediaUrls = photos
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map((url, i) => ({ url: String(url), sortOrder: i }));
  }

  // imagenes: ["url1"] (iCasas, algunos Kiteprop)
  if (mediaUrls.length === 0 && Array.isArray(r.imagenes)) {
    mediaUrls = (r.imagenes as unknown[])
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map((url, i) => ({ url: String(url), sortOrder: i }));
  }

  // fotos: [{ url, orden }] (Toctoc)
  if (mediaUrls.length === 0 && Array.isArray(r.fotos)) {
    mediaUrls = (r.fotos as { url?: string; orden?: number }[])
      .filter((f) => typeof f?.url === 'string' && f.url.length > 0)
      .map((f, i) => ({
        url: String(f.url),
        sortOrder: typeof f.orden === 'number' ? f.orden : i,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const heroImageUrl = mediaUrls[0]?.url ?? null;

  return { heroImageUrl, title, mediaUrls };
}
