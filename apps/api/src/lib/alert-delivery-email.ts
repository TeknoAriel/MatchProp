/**
 * Email al usuario cuando se crea un AlertDelivery (Sprint 8.2).
 * Solo envía si SendGrid está configurado (DB o env); no dispara sin transport real.
 */
import { prisma } from './prisma.js';
import { config } from '../config.js';
import { getMailerForSend, isSendGridAvailableForSend } from '../services/mailer/index.js';

const TYPE_COPY: Record<
  'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET',
  { short: string; subject: string }
> = {
  NEW_LISTING: {
    short: 'Nueva publicación',
    subject: 'Nueva propiedad que coincide con tu búsqueda',
  },
  PRICE_DROP: {
    short: 'Bajó el precio',
    subject: 'Una propiedad de tu alerta bajó de precio',
  },
  BACK_ON_MARKET: {
    short: 'Volvió al mercado',
    subject: 'Una propiedad volvió al mercado',
  },
};

export async function sendAlertDeliveryEmail(opts: {
  userId: string;
  listingId: string;
  alertType: 'NEW_LISTING' | 'PRICE_DROP' | 'BACK_ON_MARKET';
}): Promise<void> {
  if (!(await isSendGridAvailableForSend())) return;

  const [user, listing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: opts.userId },
      select: { email: true },
    }),
    prisma.listing.findUnique({
      where: { id: opts.listingId },
      select: { title: true, price: true, currency: true },
    }),
  ]);

  if (!user?.email) return;

  const copy = TYPE_COPY[opts.alertType];
  const title = listing?.title?.trim() || 'Propiedad';
  const priceLine =
    listing?.price != null
      ? `${listing.currency ?? 'USD'} ${listing.price.toLocaleString('es-AR')}`
      : null;

  const base = config.appUrl.replace(/\/$/, '');
  const listingUrl = `${base}/listing/${opts.listingId}`;

  const text = [
    `Hola,`,
    ``,
    `${copy.subject}: ${title}`,
    priceLine ? `Precio: ${priceLine}` : null,
    ``,
    `Ver ficha: ${listingUrl}`,
    ``,
    `— MatchProp`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
<p>Hola,</p>
<p><strong>${copy.short}:</strong> ${escapeHtml(title)}</p>
${priceLine ? `<p>Precio: ${escapeHtml(priceLine)}</p>` : ''}
<p><a href="${listingUrl}">Ver ficha en MatchProp</a></p>
<p style="color:#64748b;font-size:12px">— MatchProp</p>
`.trim();

  const mailer = await getMailerForSend();
  await mailer.sendAlertNotification({
    to: user.email,
    subject: `MatchProp · ${copy.subject}`,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
