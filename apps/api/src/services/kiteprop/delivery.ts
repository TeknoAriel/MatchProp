import { prisma } from '../../lib/prisma.js';
import { LeadDeliveryAttemptKind, LeadDeliveryAttemptStatus } from '@prisma/client';
import { decrypt } from '../../lib/crypto.js';
import { parseKitepropOpenAPI } from './openapi.js';
import { renderPayloadTemplate, renderPayloadTemplatePending } from './payload-template.js';
import type { Lead } from '@prisma/client';

export type KitepropStage = 'PENDING' | 'ACTIVE';

export async function deliverToKiteprop(
  lead: Lead & {
    listing: {
      externalId: string;
      title: string | null;
      price: number | null;
      currency: string | null;
      source?: string;
    };
    user: { email: string; profile?: { phone?: string | null; whatsapp?: string | null } | null } | null;
    publisher: { orgId: string | null; displayName?: string } | null;
  },
  opts?: { testMode?: boolean; stage?: KitepropStage }
): Promise<{ ok: boolean; httpStatus?: number; snippet?: string }> {
  const testMode = opts?.testMode ?? false;
  const stage = opts?.stage ?? 'ACTIVE';
  const orgId = lead.publisher?.orgId ?? null;
  const nullOrgWhere = { orgId: null, isEnabled: true, apiKeyEncrypted: { not: null } };
  const preferUser = (uid: string | null) =>
    uid
      ? prisma.kitepropIntegration
          .findUnique({
            where: { userId: uid },
          })
          .then((i) => (i?.orgId === null && i?.isEnabled && i?.apiKeyEncrypted ? i : null))
      : Promise.resolve(null);
  const integration = orgId
    ? ((await prisma.kitepropIntegration.findFirst({
        where: { orgId, isEnabled: true, apiKeyEncrypted: { not: null } },
      })) ??
      (await preferUser(lead.userId)) ??
      (await prisma.kitepropIntegration.findFirst({ where: nullOrgWhere })))
    : ((await preferUser(lead.userId)) ??
      (await prisma.kitepropIntegration.findFirst({ where: nullOrgWhere })));
  if (!integration?.apiKeyEncrypted) {
    return { ok: false, snippet: 'Kiteprop adapter not configured' };
  }

  let apiKey: string;
  try {
    apiKey = decrypt(integration.apiKeyEncrypted);
  } catch {
    return { ok: false, snippet: 'Failed to decrypt API key' };
  }

  const config = parseKitepropOpenAPI() ?? {
    baseUrl: integration.baseUrl,
    leadCreatePath: integration.leadCreatePath,
    authHeaderName: integration.authHeaderName,
    authFormat: (integration.authFormat as 'Bearer' | 'ApiKey') ?? 'ApiKey',
    requiredFields: ['email', 'message', 'listing_id'],
  };

  const baseUrl = integration.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${integration.leadCreatePath.startsWith('/') ? integration.leadCreatePath : '/' + integration.leadCreatePath}`;

  const buyerPhone =
    (lead.user as { profile?: { phone?: string; whatsapp?: string } | null } | undefined)?.profile?.phone ||
    (lead.user as { profile?: { phone?: string; whatsapp?: string } | null } | undefined)?.profile?.whatsapp ||
    '';
  const listingSource =
    (lead.listing as { source?: string }).source ?? (lead.publisher?.displayName ?? 'MatchProp');
  const defaultMessage =
    `Consulta desde MatchProp sobre propiedad ${lead.listing.title ?? 'N/A'} de ${listingSource}. Tel: ${buyerPhone || '-'}. Mail: ${lead.user?.email ?? 'unknown@matchprop.com'}`;

  const context = {
    buyer: {
      email: lead.user?.email ?? 'unknown@matchprop.com',
      id: lead.userId ?? '',
      phone: buyerPhone,
    },
    lead: {
      message: lead.message ?? defaultMessage,
      id: lead.id,
    },
    listing: {
      id: lead.listingId,
      externalId: lead.listing.externalId,
      title: lead.listing.title,
      price: lead.listing.price,
      currency: lead.listing.currency,
      url: '',
      source: listingSource,
    },
  };

  const defaultPayload = (
    l: typeof lead,
    ctx: typeof context,
    st: KitepropStage
  ): Record<string, unknown> => {
    const base = {
      message: ctx.lead.message,
      listing_id: ctx.listing.externalId,
      listing_title: ctx.listing.title,
      listing_price: ctx.listing.price,
      listing_currency: ctx.listing.currency,
      source: l.source ?? 'FEED',
    };
    if (st === 'PENDING') return base;
    return {
      ...base,
      email: ctx.buyer.email,
      name: ctx.buyer.email.split('@')[0] ?? 'Usuario',
      phone: ctx.buyer.phone || undefined,
    };
  };

  const ki = integration as {
    payloadTemplatePending?: string | null;
    payloadTemplateActive?: string | null;
  };
  const templatePending = ki.payloadTemplatePending?.trim() || integration.payloadTemplate?.trim();
  const templateActive = ki.payloadTemplateActive?.trim() || integration.payloadTemplate?.trim();
  const template = stage === 'PENDING' ? templatePending : templateActive;

  let payload: Record<string, unknown>;
  if (template) {
    try {
      payload =
        stage === 'PENDING'
          ? renderPayloadTemplatePending(template, context)
          : renderPayloadTemplate(template, context);
    } catch {
      payload = defaultPayload(lead, context, stage);
    }
  } else {
    payload = defaultPayload(lead, context, stage);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.authFormat === 'Bearer') {
    headers[config.authHeaderName] = `Bearer ${apiKey}`;
  } else {
    headers[config.authHeaderName] = apiKey;
  }

  // Idempotencia por etapa: no reenviar si ya hay attempt OK para este stage
  if (!testMode) {
    const existingOk = await prisma.leadDeliveryAttempt.findFirst({
      where: {
        leadId: lead.id,
        kind: LeadDeliveryAttemptKind.KITEPROP,
        status: LeadDeliveryAttemptStatus.OK,
        payloadStage: stage,
      },
    });
    if (existingOk) {
      return {
        ok: true,
        httpStatus: existingOk.httpStatus ?? 200,
        snippet: existingOk.responseBodySnippet ?? 'Already delivered',
      };
    }
  }

  const FETCH_TIMEOUT_MS = 15000;
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const snippet = (await res.text()).slice(0, 500);
      if (!testMode) {
        await prisma.leadDeliveryAttempt.create({
          data: {
            leadId: lead.id,
            kind: LeadDeliveryAttemptKind.KITEPROP,
            status: res.ok ? LeadDeliveryAttemptStatus.OK : LeadDeliveryAttemptStatus.FAIL,
            payloadStage: stage,
            httpStatus: res.status,
            responseBodySnippet: snippet || null,
            retries: attempt,
          },
        });
      }
      if (res.ok) return { ok: true, httpStatus: res.status, snippet };
      const is4xx = res.status >= 400 && res.status < 500;
      if (is4xx) return { ok: false, httpStatus: res.status, snippet };
      if (res.status >= 500 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, httpStatus: res.status, snippet };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const msg = isTimeout ? 'timeout' : err instanceof Error ? err.message : String(err);
      if (!testMode) {
        await prisma.leadDeliveryAttempt.create({
          data: {
            leadId: lead.id,
            kind: LeadDeliveryAttemptKind.KITEPROP,
            status: LeadDeliveryAttemptStatus.FAIL,
            payloadStage: stage,
            responseBodySnippet: msg.slice(0, 500),
            retries: attempt,
          },
        });
      }
      if (!isTimeout && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, snippet: msg };
    }
  }
  return { ok: false, snippet: 'Max retries exceeded' };
}
