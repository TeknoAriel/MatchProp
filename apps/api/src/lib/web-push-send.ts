/**
 * Web Push (PWA) para alertas: escritorio y móvil con soporte de notificaciones.
 * Requiere VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en el servidor.
 */
import webpush from 'web-push';
import { prisma } from './prisma.js';
import { config } from '../config.js';

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return false;
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:noreply@matchprop.com';
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

const ALERT_TITLE: Record<
  'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET',
  { title: string; bodyPrefix: string }
> = {
  NEW_LISTING: {
    title: 'Nueva propiedad',
    bodyPrefix: 'Coincide con tu búsqueda',
  },
  PRICE_DROP: {
    title: 'Bajó el precio',
    bodyPrefix: 'Una propiedad de tu alerta',
  },
  BACK_ON_MARKET: {
    title: 'Volvió al mercado',
    bodyPrefix: 'Una propiedad que seguís',
  },
};

export async function sendAlertWebPush(opts: {
  userId: string;
  listingId: string;
  alertType: 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
}): Promise<void> {
  if (!ensureVapid()) return;

  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
    select: { title: true },
  });
  const label = ALERT_TITLE[opts.alertType];
  const title = `${label.title} · MatchProp`;
  const listingTitle = listing?.title?.trim() || 'Propiedad';
  const body = `${label.bodyPrefix}: ${listingTitle}`;

  const base = config.appUrl.replace(/\/$/, '');
  const url = `${base}/listing/${opts.listingId}`;

  const payload = JSON.stringify({
    title,
    body,
    url,
    tag: `alert-${opts.listingId}-${opts.alertType}`,
  });

  const subs = await prisma.webPushSubscription.findMany({
    where: { userId: opts.userId },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 86_400, urgency: 'normal' }
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await prisma.webPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}
