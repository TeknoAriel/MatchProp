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

  // Vercel Functions llegan como /api/<path>. Nuestra API rutea desde "/".
  if (req.url) req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';

  // Fastify expone un servidor Node HTTP; reutilizamos el request/response.
  app.server.emit('request', req, res);
}

