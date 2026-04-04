/**
 * Una sola petición de verificación por token (React Strict Mode en dev monta el efecto 2 veces
 * y consumía el token en el 1er POST y fallaba el 2º con "inválido o expirado").
 * Timeout largo: proxy /api → API en Vercel puede tardar en cold start.
 */
const MAGIC_VERIFY_MS = 120_000;
const inflight = new Map<string, Promise<Response>>();

export function fetchMagicVerifyOnce(token: string, apiBase: string): Promise<Response> {
  let p = inflight.get(token);
  if (p) return p;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAGIC_VERIFY_MS);
  p = fetch(`${apiBase}/auth/magic/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  inflight.set(token, p);
  return p;
}
