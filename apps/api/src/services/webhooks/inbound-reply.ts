import { prisma } from '../../lib/prisma.js';
import { MessageSenderType, NotificationType } from '@prisma/client';

export type ParsedInboundReply = {
  leadId: string;
  body: string;
  source: 'generic' | 'kiteprop';
};

const MATCHPROP_LEAD_REF_RE = /\[MatchProp\s+leadId:\s*([^\]]+)\]/i;

function extractLeadIdFromMessageText(text: string): { leadId: string; cleanedBody: string } | null {
  const m = MATCHPROP_LEAD_REF_RE.exec(text);
  if (!m) return null;
  const leadId = String(m[1] ?? '').trim();
  if (!leadId) return null;
  const cleanedBody = text.replace(MATCHPROP_LEAD_REF_RE, '').trim();
  return { leadId, cleanedBody };
}

/**
 * Extrae leadId y texto de respuesta desde payload genérico.
 * Body mínimo: { "leadId": "cuid", "message": "..." } o "body" en lugar de message.
 */
export function parseGenericInbound(body: Record<string, unknown>): ParsedInboundReply | null {
  const leadId =
    (typeof body.leadId === 'string' && body.leadId) ||
    (typeof body.matchprop_lead_id === 'string' && body.matchprop_lead_id) ||
    null;
  const text =
    (typeof body.message === 'string' && body.message) ||
    (typeof body.body === 'string' && body.body) ||
    (typeof body.reply === 'string' && body.reply) ||
    (typeof body.text === 'string' && body.text) ||
    null;
  if (!text?.trim()) return null;

  const rawText = String(text).trim();
  let finalLeadId = leadId ? String(leadId).trim() : null;
  let cleanedBody = rawText;

  if (!finalLeadId) {
    const extracted = extractLeadIdFromMessageText(rawText);
    if (!extracted) return null;
    finalLeadId = extracted.leadId;
    cleanedBody = extracted.cleanedBody;
  } else {
    const extracted = extractLeadIdFromMessageText(rawText);
    if (extracted) cleanedBody = extracted.cleanedBody;
  }

  if (!finalLeadId) return null;
  return { leadId: finalLeadId, body: cleanedBody || rawText, source: 'generic' };
}

/**
 * Parser adaptado a respuestas tipo Kiteprop / inmobiliaria.
 * Variantes soportadas:
 * - { "matchprop_lead_id": "...", "body": "..." }
 * - { "lead_id": "...", "message": "..." }
 * - { "leadId": "...", "reply": "..." }
 */
export function parseKitepropInbound(body: Record<string, unknown>): ParsedInboundReply | null {
  const leadId =
    (typeof body.matchprop_lead_id === 'string' && body.matchprop_lead_id) ||
    (typeof body.lead_id === 'string' && body.lead_id) ||
    (typeof body.leadId === 'string' && body.leadId) ||
    (typeof body.matchpropLeadId === 'string' && body.matchpropLeadId) ||
    null;
  const msg =
    (typeof body.body === 'string' && body.body) ||
    (typeof body.message === 'string' && body.message) ||
    (typeof body.reply === 'string' && body.reply) ||
    (typeof body.reply_text === 'string' && body.reply_text) ||
    null;
  if (!msg?.trim()) return null;

  const rawMsg = String(msg).trim();
  let finalLeadId = leadId ? String(leadId).trim() : null;
  let cleanedBody = rawMsg;

  if (!finalLeadId) {
    const extracted = extractLeadIdFromMessageText(rawMsg);
    if (!extracted) return null;
    finalLeadId = extracted.leadId;
    cleanedBody = extracted.cleanedBody;
  } else {
    const extracted = extractLeadIdFromMessageText(rawMsg);
    if (extracted) cleanedBody = extracted.cleanedBody;
  }

  if (!finalLeadId) return null;
  return { leadId: finalLeadId, body: cleanedBody || rawMsg, source: 'kiteprop' };
}

export async function recordPublisherReply(
  parsed: ParsedInboundReply
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: parsed.leadId },
    select: { id: true, userId: true },
  });
  if (!lead) {
    return { ok: false, error: 'Lead no encontrado' };
  }

  const msg = await prisma.message.create({
    data: {
      leadId: parsed.leadId,
      senderType: MessageSenderType.PUBLISHER,
      body: parsed.body,
    },
  });

  await prisma.leadEvent.create({
    data: {
      leadId: parsed.leadId,
      type: 'INBOUND_REPLY',
      payloadJson: {
        source: parsed.source,
        messageId: msg.id,
        preview: parsed.body.slice(0, 200),
      },
    },
  });

  if (lead.userId) {
    await prisma.notification.create({
      data: {
        userId: lead.userId,
        type: NotificationType.LEAD_REPLY,
        payload: {
          leadId: parsed.leadId,
          kind: 'publisher_reply',
          messageId: msg.id,
        },
      },
    });
  }

  return { ok: true, messageId: msg.id };
}
