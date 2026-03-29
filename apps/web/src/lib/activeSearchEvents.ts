/** Sincroniza todas las instancias de ActiveSearchBar en la misma pestaña. */
export const ACTIVE_SEARCH_CHANGED_EVENT = 'mp:active-search-changed';

export function notifyActiveSearchChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACTIVE_SEARCH_CHANGED_EVENT));
}
