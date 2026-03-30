/** True si el ítem debe renderizarse como `<video>` (tipo explícito o extensión de URL). */
export function isListingVideoMedia(type?: string | null, url?: string | null): boolean {
  if ((type ?? '').toUpperCase() === 'VIDEO') return true;
  const u = (url ?? '').trim().toLowerCase();
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(u);
}
