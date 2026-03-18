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

/** Quita del query string el param del catch-all (path / [...path]) para no pasarlo a Fastify. */
function stripCatchAllFromQuery(qs: string): string {
  if (!qs || !qs.startsWith('?')) return qs;
  const params = new URLSearchParams(qs.slice(1));
  const toDelete = new Set<string>();
  for (const key of params.keys()) {
    if (key === 'path' || key.includes('path') && key.includes('...')) toDelete.add(key);
  }
  toDelete.forEach((k) => params.delete(k));
  const rest = params.toString();
  return rest ? '?' + rest : '';
}

/** Construye path + query para Fastify. Usa x-vercel-original-url o req.url. */
function pathForFastify(req: VercelRequest): string {
  // Vercel pone la URL original en este header cuando hay rewrite
  const originalUrl =
    (req.headers['x-vercel-original-url'] as string) ||
    (req.headers['x-original-url'] as string) ||
    (req.headers['x-url'] as string) ||
    req.url ||
    '/';

  let pathname = '/';
  let qs = '';

  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    try {
      const u = new URL(originalUrl);
      pathname = u.pathname;
      qs = u.search || '';
    } catch {
      const idx = originalUrl.indexOf('?');
      if (idx >= 0) {
        pathname = originalUrl.slice(originalUrl.indexOf('/', 8), idx) || '/';
        qs = originalUrl.slice(idx);
      } else {
        pathname = originalUrl.slice(originalUrl.indexOf('/', 8)) || '/';
      }
    }
  } else {
    const idx = originalUrl.indexOf('?');
    if (idx >= 0) {
      pathname = originalUrl.slice(0, idx) || '/';
      qs = originalUrl.slice(idx);
    } else {
      pathname = originalUrl || '/';
    }
  }

  // Quitar /api/handler si el rewrite lo agregó
  pathname = pathname.replace(/^\/api\/handler\/?/i, '/');
  // Quitar /api si existe
  pathname = pathname.replace(/^\/api(?=\/|$)/i, '') || '/';

  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  return pathname + qs;
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

const BODY_READ_TIMEOUT_MS = 8000;

/** Lee el body del request: usa req.body si existe, si no lee del stream. Timeout para no colgar. */
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
    const timeout = setTimeout(() => {
      resolve(undefined);
    }, BODY_READ_TIMEOUT_MS);
    const chunks: Buffer[] = [];
    const stream = req as NodeJS.ReadableStream;
    const done = (value: string | Record<string, unknown> | undefined) => {
      clearTimeout(timeout);
      resolve(value);
    };
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        done(undefined);
        return;
      }
      const ct = (req.headers['content-type'] ?? '').toLowerCase();
      if (ct.includes('application/json')) {
        try {
          done(JSON.parse(raw) as Record<string, unknown>);
        } catch {
          done(raw);
        }
      } else {
        done(raw);
      }
    });
    stream.on('error', () => done(undefined));
  });
}

/** Respuesta de Fastify inject (LightMyRequest). */
type InjectResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  payload: string | Buffer;
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.status(status);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  const path = pathForFastify(req);

  // Debug endpoint para ver qué recibe el handler
  if (req.url?.includes('__debug_raw') || path === '/__debug_raw') {
    res.status(200).json({
      reqUrl: req.url,
      path,
      method,
      headers: {
        'x-vercel-original-url': req.headers['x-vercel-original-url'],
        'x-original-url': req.headers['x-original-url'],
        'x-url': req.headers['x-url'],
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        host: req.headers['host'],
      },
      query: req.query,
    });
    return;
  }

  const wantsDebug =
    path === '/debug/invoke' ||
    path === '/__vercel_debug' ||
    String(req.url ?? '').includes('debug') ||
    (req.query?.path && String(req.query.path).includes('debug'));
  if (wantsDebug) {
    sendJson(res, 200, {
      path,
      method,
      query: req.query,
      url: req.url,
      contentType: req.headers['content-type'],
      pathFromQuery: req.query?.path,
    });
    return;
  }

  try {
    const app = await getApp();
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
    if (response.statusCode === 404) {
      res.setHeader('X-MatchProp-Path', path);
      res.setHeader('X-MatchProp-Method', method);
    }
    for (const [key, value] of Object.entries(response.headers)) {
      if (value === undefined) continue;
      res.setHeader(key, value);
    }
    res.end(response.payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[MatchProp handler error]', { path, method, message: msg, stack });
    sendJson(res, 500, {
      message: 'Error interno del servidor.',
      code: 'HANDLER_ERROR',
      debug: { path, method, error: msg },
    });
  }
}
