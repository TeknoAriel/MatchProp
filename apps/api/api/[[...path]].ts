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

/** Lee el body del request: usa req.body si existe, si no lee del stream (por si Vercel no lo inyecta). */
function getRequestBody(
  req: VercelRequest,
  method: string
): Promise<string | Record<string, unknown> | undefined> {
  if (method === 'GET' || method === 'HEAD') return Promise.resolve(undefined);
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(
      typeof req.body === 'string' ? req.body : (req.body as Record<string, unknown>)
    );
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    (req as NodeJS.ReadableStream).on('data', (chunk: Buffer) => chunks.push(chunk));
    (req as NodeJS.ReadableStream).on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      const ct = (req.headers['content-type'] ?? '').toLowerCase();
      if (ct.includes('application/json')) {
        try {
          resolve(JSON.parse(raw) as Record<string, unknown>);
        } catch {
          resolve(raw);
        }
      } else {
        resolve(raw);
      }
    });
    (req as NodeJS.ReadableStream).on('error', () => resolve(undefined));
  });
}

/** Respuesta de Fastify inject (LightMyRequest). */
type InjectResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  payload: string | Buffer;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  const path = pathForFastify(req);
  const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  const headers = headersForInject(req.headers);
  let payload = await getRequestBody(req, method);
  if (payload !== undefined && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

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
