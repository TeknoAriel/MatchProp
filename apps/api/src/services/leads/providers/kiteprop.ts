/**
 * Provider Kiteprop para envío de leads.
 * Sprint 1: implementación mock/noop (no falla).
 * Sprint 2: conectar credenciales reales y enviar.
 */

export interface LeadPayload {
  id: string;
  userId: string | null;
  listingId: string;
  channel: string;
  message: string | null;
  targetPublisherRef: string | null;
}

export async function sendLead(
  _lead: LeadPayload
): Promise<{ success: boolean; externalId?: string }> {
  // Sprint 1: noop. Sprint 2: POST a API Kiteprop real.
  return { success: true };
}
