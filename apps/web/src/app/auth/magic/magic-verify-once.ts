/**
 * Una sola petición de verificación por token (React Strict Mode en dev monta el efecto 2 veces
 * y consumía el token en el 1er POST y fallaba el 2º con "inválido o expirado").
 */
const inflight = new Map<string, Promise<Response>>();

export function fetchMagicVerifyOnce(token: string, apiBase: string): Promise<Response> {
  let p = inflight.get(token);
  if (p) return p;
  p = fetch(`${apiBase}/auth/magic/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  inflight.set(token, p);
  return p;
}
