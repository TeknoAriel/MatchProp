/**
 * trackEvent: registra eventos sin PII.
 * payloadJson no debe incluir email, phone, name ni datos sensibles.
 */
import { prisma } from './prisma.js';

export async function trackEvent(
  eventName: string,
  opts?: { userId?: string; payload?: Record<string, unknown> }
): Promise<void> {
  const payload = opts?.payload ?? {};
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && /@|phone|email|tel/i.test(k)) continue;
    sanitized[k] = v;
  }
  await prisma.analyticsEvent.create({
    data: {
      eventName,
      userId: opts?.userId ?? null,
      payloadJson: sanitized as object,
    },
  });
}
