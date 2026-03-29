import { createHmac } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import {
  LeadDeliveryAttemptKind,
  LeadDeliveryAttemptStatus,
  LeadStatus,
  NotificationType,
} from '@prisma/client';
import { deliverToKiteprop } from '../kiteprop/delivery.js';

const EVENT_TYPE_CREATED = 'LEAD_CREATED';
const EVENT_TYPE_ACTIVATED = 'LEAD_ACTIVATED';
const MAX_RETRIES = 3;

export async function processLeadCreatedEvent(
  eventId: string
): Promise<{ processed: boolean; error?: string }> {
  const ev = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
  });
  if (!ev || ev.type !== EVENT_TYPE_CREATED || ev.processedAt) {
    return { processed: false };
  }

  const payload = ev.payload as { leadId?: string };
  const leadId = payload?.leadId;
  if (!leadId) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: 'Missing leadId' },
    });
    return { processed: true, error: 'Missing leadId' };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      listing: true,
      user: {
        select: {
          email: true,
          profile: { select: { phone: true, whatsapp: true } },
        },
      },
      publisher: { include: { endpoints: { where: { isEnabled: true } } } },
    },
  });
  if (!lead) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: 'Lead not found' },
    });
    return { processed: true, error: 'Lead not found' };
  }

  // PENDING: enviar template PENDING (sin PII) vía Kiteprop
  if (lead.status === LeadStatus.PENDING) {
    await deliverToKiteprop(lead, { stage: 'PENDING' });
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
    return { processed: true };
  }

  const existingOk = await prisma.leadDeliveryAttempt.findFirst({
    where: { leadId, status: LeadDeliveryAttemptStatus.OK },
  });
  if (existingOk) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
    return { processed: true };
  }

  let delivered = false;
  const endpoints = lead.publisher?.endpoints ?? [];

  for (const ep of endpoints) {
    if (ep.kind === 'WEBHOOK' && ep.webhookUrl) {
      const ok = await deliverWebhook(lead, ep.webhookUrl, ep.webhookSecretHash ?? undefined);
      if (ok) {
        delivered = true;
        break;
      }
    }
  }
  if (!delivered) {
    const kitepropStart = Date.now();
    const result = await deliverToKiteprop(lead, { stage: 'ACTIVE' });
    const kitepropMs = Date.now() - kitepropStart;
    if (kitepropMs > 5000) {
      console.warn(`[lead-delivery] Kiteprop slow leadId=${leadId} ms=${kitepropMs}`);
    }
    if (result.ok) delivered = true;
  }
  if (!delivered) {
    const ok = await deliverConsole(lead);
    if (ok) delivered = true;
  }

  const wasActive = lead.status === LeadStatus.ACTIVE;
  const finalStatus =
    delivered ? LeadStatus.ACTIVE : wasActive ? LeadStatus.ACTIVE : LeadStatus.PENDING;
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: finalStatus },
  });

  if (lead.userId && delivered) {
    await prisma.notification.create({
      data: {
        userId: lead.userId,
        type: NotificationType.LEAD_SENT,
        payload: {
          leadId: lead.id,
          listingId: lead.listingId,
          listingTitle: lead.listing?.title,
        },
      },
    });
  }

  await prisma.outboxEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });

  return { processed: true };
}

export async function processLeadActivatedEvent(
  eventId: string
): Promise<{ processed: boolean; error?: string }> {
  const ev = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
  });
  if (!ev || ev.type !== EVENT_TYPE_ACTIVATED || ev.processedAt) {
    return { processed: false };
  }

  const payload = ev.payload as { leadId?: string };
  const leadId = payload?.leadId;
  if (!leadId) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: 'Missing leadId' },
    });
    return { processed: true, error: 'Missing leadId' };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      listing: true,
      user: {
        select: {
          email: true,
          profile: { select: { phone: true, whatsapp: true } },
        },
      },
      publisher: { include: { endpoints: { where: { isEnabled: true } } } },
    },
  });
  if (!lead || lead.status !== LeadStatus.ACTIVE) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), lastError: 'Lead not ACTIVE' },
    });
    return { processed: true, error: 'Lead not ACTIVE' };
  }

  const existingOk = await prisma.leadDeliveryAttempt.findFirst({
    where: {
      leadId,
      kind: LeadDeliveryAttemptKind.KITEPROP,
      status: LeadDeliveryAttemptStatus.OK,
      payloadStage: 'ACTIVE',
    },
  });
  if (existingOk) {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
    return { processed: true };
  }

  let delivered = false;
  const endpoints = lead.publisher?.endpoints ?? [];
  for (const ep of endpoints) {
    if (ep.kind === 'WEBHOOK' && ep.webhookUrl) {
      const ok = await deliverWebhook(lead, ep.webhookUrl, ep.webhookSecretHash ?? undefined);
      if (ok) {
        delivered = true;
        break;
      }
    }
  }
  if (!delivered) {
    const result = await deliverToKiteprop(lead, { stage: 'ACTIVE' });
    if (result.ok) delivered = true;
  }
  if (!delivered) {
    const ok = await deliverConsole(lead);
    if (ok) delivered = true;
  }

  if (lead.userId && delivered) {
    await prisma.notification.create({
      data: {
        userId: lead.userId,
        type: NotificationType.LEAD_SENT,
        payload: {
          leadId: lead.id,
          listingId: lead.listingId,
          listingTitle: lead.listing?.title,
        },
      },
    });
  }

  await prisma.outboxEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });
  return { processed: true };
}

async function deliverWebhook(
  lead: {
    id: string;
    listingId: string;
    message: string | null;
    listing: {
      title: string | null;
      price: number | null;
      currency: string | null;
      locationText: string | null;
    };
  },
  webhookUrl: string,
  secretHash?: string
): Promise<boolean> {
  const payload = {
    leadId: lead.id,
    listingId: lead.listingId,
    message: lead.message,
    listing: {
      title: lead.listing.title,
      price: lead.listing.price,
      currency: lead.listing.currency,
      locationText: lead.listing.locationText,
    },
  };
  const body = JSON.stringify(payload);
  let signature: string | undefined;
  if (secretHash) {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      signature = createHmac('sha256', secret).update(body).digest('hex');
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (signature) headers['X-Webhook-Signature'] = `sha256=${signature}`;

  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
      });
      const snippet = (await res.text()).slice(0, 500);
      await prisma.leadDeliveryAttempt.create({
        data: {
          leadId: lead.id,
          kind: LeadDeliveryAttemptKind.WEBHOOK,
          status: res.ok ? LeadDeliveryAttemptStatus.OK : LeadDeliveryAttemptStatus.FAIL,
          httpStatus: res.status,
          responseBodySnippet: snippet || null,
          retries: attempt,
        },
      });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await prisma.leadDeliveryAttempt.create({
        data: {
          leadId: lead.id,
          kind: LeadDeliveryAttemptKind.WEBHOOK,
          status: LeadDeliveryAttemptStatus.FAIL,
          responseBodySnippet: lastError.slice(0, 500),
          retries: attempt,
        },
      });
    }
  }
  return false;
}

async function deliverConsole(lead: {
  id: string;
  listingId: string;
  message: string | null;
  listing: { title: string | null };
}): Promise<boolean> {
  console.log('[Lead] delivery console', {
    leadId: lead.id,
    listingId: lead.listingId,
    title: lead.listing.title,
    message: lead.message,
  });
  await prisma.leadDeliveryAttempt.create({
    data: {
      leadId: lead.id,
      kind: LeadDeliveryAttemptKind.CONSOLE,
      status: LeadDeliveryAttemptStatus.OK,
      retries: 0,
    },
  });
  return true;
}
