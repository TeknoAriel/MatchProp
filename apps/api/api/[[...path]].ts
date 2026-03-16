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
  // Fuente fiable: query.path del catch-all (ej. ["assistant", "search"] o "assistant/search" -> "/assistant/search")
  const pathFromQuery = req.query?.path;
  if (pathFromQuery !== undefined && pathFromQuery !== null) {
    const segments = Array.isArray(pathFromQuery) ? pathFromQuery : String(pathFromQuery).split('/').filter(Boolean);
    if (segments.length > 0) {
      const path = '/' + segments.join('/');
      const qs = typeof req.url === 'string' && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return path + (qs.startsWith('?') ? qs : '');
    }
  }
  // Fallback: parsear req.url (puede ser path solo o URL completa)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();

  req.url = pathForFastify(req);

  await new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('error', reject);
    app.server.emit('request', req, res);
  });
}
