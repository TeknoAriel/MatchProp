/**
 * Para datos demo: si la URL es el placeholder SVG viejo (/demo/photos/*.svg),
 * devuelve una imagen de Picsum determinística por id para que se vean fotos en fichas
 * sin re-ejecutar el seed. Cuando las APIs provean imágenes reales, esto no se usa.
 */
export function getListingImageUrl(
  listingId: string | undefined,
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const isOldDemoSvg =
    typeof url === 'string' &&
    url.includes('/demo/photos/') &&
    (url.endsWith('.svg') || url.includes('.svg'));
  if (isOldDemoSvg && listingId) {
    let seed = 0;
    for (let i = 0; i < listingId.length; i++) seed = (seed << 5) - seed + listingId.charCodeAt(i);
    seed = Math.abs(seed);
    return `https://picsum.photos/seed/${seed}/800/600`;
  }
  return url;
}
