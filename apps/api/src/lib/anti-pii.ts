/**
 * Filtro anti-PII: detecta y bloquea emails, URLs, teléfonos en texto.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s]+/gi;
const PHONE_RE = /(\+?[0-9]{2,3}[-.\s]?)?[0-9]{3,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g;

export type AntiPiiResult = {
  blocked: boolean;
  cleanBody: string;
  blockedReason: string | null;
};

export function filterPii(body: string): AntiPiiResult {
  let clean = body;
  const reasons: string[] = [];

  if (EMAIL_RE.test(body)) {
    clean = clean.replace(EMAIL_RE, '[BLOCKED]');
    reasons.push('email');
  }
  if (URL_RE.test(clean)) {
    clean = clean.replace(URL_RE, '[BLOCKED]');
    reasons.push('url');
  }
  if (PHONE_RE.test(clean)) {
    clean = clean.replace(PHONE_RE, '[BLOCKED]');
    reasons.push('phone');
  }

  return {
    blocked: reasons.length > 0,
    cleanBody: reasons.length > 0 ? clean : body,
    blockedReason: reasons.length > 0 ? reasons.join(',') : null,
  };
}
