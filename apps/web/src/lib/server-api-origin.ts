/**
 * Origen de la API para fetch en Server Components / generateMetadata.
 * Debe coincidir con la lógica de `next.config.ts` (rewrites /api → API).
 */
export function getServerApiOrigin(): string {
  const fromEnv = process.env.API_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL) return 'https://match-prop-admin-dsvv.vercel.app';
  return 'http://127.0.0.1:3001';
}
