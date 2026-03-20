/**
 * Sistema de Notificaciones Push con mensajes divertidos
 */

// Mensajes divertidos para notificaciones
const NOTIFICATION_MESSAGES = {
  match: {
    titles: ['🎉 ¡Tenemos match!', '✨ ¡Encontramos algo para vos!', '🏠 ¡Esta te va a encantar!'],
    bodies: [
      'Una propiedad coincide perfectamente con tu búsqueda',
      'Mirá esta propiedad que encontramos para vos',
      '¿Será esta la indicada? ¡Entrá a verla!',
    ],
  },
  priceDown: {
    titles: ['📉 ¡Urraa! ¡Bajó de precio!', '💰 ¡Buenas noticias!', '🎯 ¡Oferta detectada!'],
    bodies: [
      'Una propiedad que seguís acaba de bajar de precio',
      'El precio bajó en una propiedad de tu lista',
      '¡No te lo pierdas! Bajó el precio',
    ],
  },
  newMessage: {
    titles: ['💬 ¡Te respondieron!', '📩 ¡Nuevo mensaje!', '🔔 ¡Ding dong!'],
    bodies: [
      'Tenés una respuesta a tu consulta',
      'Alguien te escribió sobre una propiedad',
      'Hay novedades en tu chat',
    ],
  },
  newListing: {
    titles: ['🆕 ¡Nueva propiedad!', '🔥 ¡Recién publicada!', '👀 ¡Mirá esto!'],
    bodies: [
      'Hay una nueva propiedad que coincide con tu búsqueda',
      'Acaba de publicarse algo que te puede interesar',
      'Nueva propiedad en tu zona de interés',
    ],
  },
  visitReminder: {
    titles: ['📅 ¡Recordatorio de visita!', '🏠 ¡Hoy tenés visita!', '⏰ ¡No te olvides!'],
    bodies: [
      'Tu visita es hoy. ¡Suerte!',
      'Recordá tu visita programada',
      '¡Preparate para conocer tu nueva casa!',
    ],
  },
  leadActive: {
    titles: ['🚀 ¡Consulta activada!', '✅ ¡Ya podés chatear!', '💬 ¡Conectado!'],
    bodies: [
      'Tu consulta fue activada. Ya podés coordinar',
      'Ahora podés chatear y agendar visitas',
      '¡Genial! La inmobiliaria te está esperando',
    ],
  },
};

type NotificationType = keyof typeof NOTIFICATION_MESSAGES;

function getRandomItem<T>(arr: T[], fallback: T): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? fallback;
}

export function getNotificationContent(type: NotificationType): { title: string; body: string } {
  const messages = NOTIFICATION_MESSAGES[type];
  return {
    title: getRandomItem(messages.titles, '¡Novedad!'),
    body: getRandomItem(messages.bodies, 'Tenés algo nuevo para ver'),
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Este navegador no soporta notificaciones');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export async function showNotification(
  type: NotificationType,
  options?: {
    customTitle?: string;
    customBody?: string;
    icon?: string;
    tag?: string;
    data?: unknown;
    onClick?: () => void;
  }
): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const content = getNotificationContent(type);

  const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
    body: options?.customBody ?? content.body,
    icon: options?.icon ?? '/icon-192.png',
    badge: '/icon-192.png',
    tag: options?.tag ?? type,
    data: options?.data,
    requireInteraction: type === 'newMessage' || type === 'visitReminder',
  };

  // vibrate no está en todos los navegadores
  if ('vibrate' in navigator) {
    (notificationOptions as { vibrate?: number[] }).vibrate = [200, 100, 200];
  }

  const notification = new Notification(options?.customTitle ?? content.title, notificationOptions);

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }
}

// Service Worker para notificaciones push (registrar en producción)
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Error registrando Service Worker:', error);
    return null;
  }
}

// Suscribirse a notificaciones push del servidor
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    // Enviar la suscripción al servidor
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(subscription),
    });

    return subscription;
  } catch (error) {
    console.error('Error suscribiéndose a push:', error);
    return null;
  }
}

// Clase para manejar notificaciones in-app
export class InAppNotificationManager {
  private listeners: Set<(notification: { type: NotificationType; data?: unknown }) => void> =
    new Set();

  subscribe(
    callback: (notification: { type: NotificationType; data?: unknown }) => void
  ): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(type: NotificationType, data?: unknown): void {
    this.listeners.forEach((callback) => callback({ type, data }));
  }
}

export const inAppNotifications = new InAppNotificationManager();
