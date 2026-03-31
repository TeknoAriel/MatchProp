/** Disparar tras cambiar estado de lectura para que la shell actualice el badge. */
export const NOTIFICATIONS_CHANGED_EVENT = 'mp-notifications-changed';

export function notifyNotificationsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
