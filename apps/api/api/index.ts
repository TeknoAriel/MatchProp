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
  const response = await app.inject({
    method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: '/',
    headers: req.headers as Record<string, string>,
  });
  res.status(response.statusCode);
  for (const [key, value] of Object.entries(response.headers)) {
    if (value) res.setHeader(key, value);
  }
  res.end(response.payload);
}
