/**
 * Sprint 10: envía payload listing.matches_found al webhook CRM.
 * Un solo intento HTTP; los reintentos con backoff los hace el worker.
 */
import { config } from '../../config.js';

export type CrmPushPayload = {
  event: 'listing.matches_found';
  listingId: string;
  matchesCount: number;
  topSearchIds: string[];
  createdAt: string;
};

export async function sendToCrmWebhook(
  payload: CrmPushPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = process.env.CRM_WEBHOOK_URL || config.crmWebhookUrl;
  if (!url || url.trim() === '') {
    return { ok: false, error: 'CRM_WEBHOOK_URL not set' };
  }

  const secret = process.env.CRM_WEBHOOK_SECRET || config.crmWebhookSecret;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['Authorization'] = `Bearer ${secret}`;
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    if (res.ok) return { ok: true, status: res.status };
    const text = await res.text();
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 500) };
  }
}
