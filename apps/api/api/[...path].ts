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
  const app = await getApp();

  const raw = req.url ?? '/';
  const [pathname, qs = ''] = raw.split('?');
  let path = (pathname || '/').replace(/^\/api(?=\/|$)/, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  req.url = path + (qs ? '?' + qs : '');

  app.server.emit('request', req, res);
}
