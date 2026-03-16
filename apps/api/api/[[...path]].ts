import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app.js';

let appPromise: Promise<Awaited<ReturnType<typeof buildApp>>> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = buildApp({ logger: false }).then(async (app: Awaited<ReturnType<typeof buildApp>>) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

/** Construye path + query para Fastify. En Vercel, el catch-all [[...path]] pone los segmentos en query.path. */
function pathForFastify(req: VercelRequest): string {
  const pathFromQuery = req.query?.path;
  if (pathFromQuery !== undefined && pathFromQuery !== null) {
    const segments = Array.isArray(pathFromQuery) ? pathFromQuery : String(pathFromQuery).split('/').filter(Boolean);
    if (segments.length > 0) {
      const path = '/' + segments.join('/');
      const qs = typeof req.url === 'string' && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return path + (qs.startsWith('?') ? qs : '');
    }
  }
  const raw = (req.url ?? '/').trim() || '/';
  let pathname: string;
  let qs = '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      pathname = u.pathname;
      qs = u.search ? u.search.slice(1) : '';
    } catch {
      const [p, q] = raw.split('?');
      pathname = p ?? '/';
      qs = q ?? '';
    }
  } else {
    const [p, q] = raw.split('?');
    pathname = (p ?? '/').trim() || '/';
    qs = (q ?? '').trim();
  }
  let path = pathname.replace(/^\/api(?=\/|$)/i, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  return path + (qs ? '?' + qs : '');
}

/** Convierte IncomingHeaders a objeto plano para Fastify inject. */
function headersForInject(headers: VercelRequest['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

/** Respuesta de Fastify inject (LightMyRequest). */
type InjectResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  payload: string | Buffer;
};

/**
 * Usamos fastify.inject() en lugar de emit('request') para que el body llegue bien.
 * En Vercel el body ya viene parseado en req.body; si pasamos el stream a Fastify, suele estar vacío.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  const path = pathForFastify(req);
  const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  const headers = headersForInject(req.headers);

  const payload =
    method !== 'GET' && method !== 'HEAD' && req.body !== undefined
      ? typeof req.body === 'string'
        ? req.body
        : req.body
      : undefined;

  const response = (await app.inject({
    method,
    url: path,
    headers,
    payload,
  })) as unknown as InjectResponse;

  res.status(response.statusCode);
  for (const [key, value] of Object.entries(response.headers)) {
    if (value === undefined) continue;
    res.setHeader(key, value);
  }
  res.end(response.payload);
}
