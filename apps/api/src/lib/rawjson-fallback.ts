/**
 * Extrae imagen y título desde rawJson cuando heroImageUrl/title están vacíos.
 * Soporta formatos de Kiteprop (photos, imagenes, images), Toctoc (fotos), Zonaprop, iCasas, etc.
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

  // Título: varios campos posibles
  const title =
    (typeof r.title === 'string' && r.title.trim()) ||
    (typeof r.titulo === 'string' && r.titulo.trim()) ||
    (typeof r.descripcion === 'string' && r.descripcion.trim().slice(0, 200)) ||
    null;

  // Imágenes: múltiples formatos conocidos
  let mediaUrls: { url: string; sortOrder: number }[] = [];

  function addFromStringArray(arr: unknown[]): boolean {
    const valid = arr
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map((url, i) => ({ url: String(url), sortOrder: i }));
    if (valid.length) {
      mediaUrls = valid;
      return true;
    }
    return false;
  }

  function addFromObjectArray(arr: { url?: string; orden?: number; order?: number }[]): boolean {
    const valid = arr
      .filter((f) => typeof f?.url === 'string' && f.url.length > 0)
      .map((f, i) => ({
        url: String(f.url),
        sortOrder:
          typeof f.orden === 'number'
            ? f.orden
            : typeof f.order === 'number'
              ? f.order
              : i,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (valid.length) {
      mediaUrls = valid;
      return true;
    }
    return false;
  }

  // photos: ["url1", "url2"] (Kiteprop)
  if (!addFromStringArray(Array.isArray(r.photos) ? r.photos : [])) {
    // imagenes: ["url1"] (iCasas, Kiteprop)
    if (!addFromStringArray(Array.isArray(r.imagenes) ? r.imagenes : [])) {
      // images: [{ url, order }] (Yumblin, Externalsite, API v1)
      if (!addFromObjectArray(Array.isArray(r.images) ? (r.images as { url?: string; order?: number }[]) : [])) {
        // fotos: [{ url, orden }] (Toctoc)
        addFromObjectArray(Array.isArray(r.fotos) ? (r.fotos as { url?: string; orden?: number }[]) : []);
      }
    }
  }

  // URLs sueltas como fallback
  if (mediaUrls.length === 0) {
    const single =
      (typeof r.image === 'string' && r.image.trim()) ||
      (typeof r.imagen === 'string' && r.imagen.trim()) ||
      (typeof r.cover_image === 'string' && r.cover_image.trim()) ||
      (typeof r.main_image === 'string' && r.main_image.trim()) ||
      null;
    if (single) mediaUrls = [{ url: single, sortOrder: 0 }];
  }

  const heroImageUrl = mediaUrls[0]?.url ?? null;

  return { heroImageUrl, title, mediaUrls };
}
