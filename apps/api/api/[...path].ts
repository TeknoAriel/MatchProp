import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app.js';

let appPromise: Promise<Awaited<ReturnType<typeof buildApp>>> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = buildApp({ logger: false }).then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug: ver req.url tal como llega (para diagnosticar 404 en /auth/*)
  const rawUrl = req.url ?? '(undefined)';
  if (rawUrl.includes('debug/req-info')) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(
      JSON.stringify({
        rawUrl,
        method: req.method,
        vercel: !!process.env.VERCEL,
      })
    );
    return;
  }

  const app = await getApp();

  // Normalizar path para Fastify: en Vercel puede venir como /api/<path> o /<path>.
  // Rewrite "/(.*)" -> "/api/$1" puede hacer que req.url sea /api/... o la ruta original.
  const raw = req.url ?? '/';
  const [pathname, qs = ''] = raw.split('?');
  let path = (pathname || '/').replace(/^\/api(?=\/|$)/, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  req.url = path + (qs ? '?' + qs : '');

  app.server.emit('request', req, res);
}

