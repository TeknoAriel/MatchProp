/**
 * Callback público de Kiteprop para envío de consultas (difusión Yumblin).
 * Documentación: mismo formato que curl a messages/callback/yumblin
 * (name, email, phone, property_id, body).
 *
 * property_id de prueba en Kiteprop: "34"
 */
export const YUMBLIN_MESSAGES_CALLBACK_URL =
  'https://www.kiteprop.com/difusions/messages/callback/yumblin';

/** Propiedad de prueba en Kiteprop (entorno evaluación). */
export const YUMBLIN_TEST_PROPERTY_ID = '34';

export type YumblinCallbackPayload = {
  name: string;
  email: string;
  phone: string;
  property_id: string;
  body: string;
};

/** Añade referencia interna para correlacionar respuestas vía webhook. */
export function appendMatchpropLeadRef(body: string, leadId: string): string {
  const ref = `\n\n[MatchProp leadId: ${leadId}]`;
  return body.includes('[MatchProp leadId:') ? body : `${body.trim()}${ref}`;
}

export async function postYumblinCallback(
  payload: YumblinCallbackPayload
): Promise<{ ok: boolean; httpStatus: number; text: string }> {
  const res = await fetch(YUMBLIN_MESSAGES_CALLBACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await res.text();
  return { ok: res.ok, httpStatus: res.status, text: text.slice(0, 500) };
}
