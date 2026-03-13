import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../../src/app.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  req.url = '/me/saved' + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
  await new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('error', reject);
    app.server.emit('request', req, res);
  });
}

