// @ts-nocheck
/* eslint-disable */

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    const { buildApp } = await import('../dist/app.js');
    appPromise = buildApp({ logger: false }).then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

function pathForFastify(req) {
  const originalUrl =
    req.headers['x-vercel-original-url'] ||
    req.headers['x-original-url'] ||
    req.headers['x-url'] ||
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

  pathname = pathname.replace(/^\/api\/handler\/?/i, '/');
  pathname = pathname.replace(/^\/api(?=\/|$)/i, '') || '/';
  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  return pathname + qs;
}

function headersForInject(headers) {
  const out = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

const BODY_READ_TIMEOUT_MS = 8000;

function getRequestBody(req, method) {
  if (method === 'GET' || method === 'HEAD') return Promise.resolve(undefined);
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(typeof req.body === 'string' ? req.body : req.body);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(undefined), BODY_READ_TIMEOUT_MS);
    const chunks = [];
    const done = (value) => {
      clearTimeout(timeout);
      resolve(value);
    };
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        done(undefined);
        return;
      }
      const ct = (req.headers['content-type'] ?? '').toLowerCase();
      if (ct.includes('application/json')) {
        try {
          done(JSON.parse(raw));
        } catch {
          done(raw);
        }
      } else {
        done(raw);
      }
    });
    req.on('error', () => done(undefined));
  });
}

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const method = req.method ?? 'GET';
  const path = pathForFastify(req);

  if (req.url?.includes('__debug_raw') || path === '/__debug_raw') {
    res.status(200).json({
      reqUrl: req.url,
      path,
      method,
      headers: {
        'x-vercel-original-url': req.headers['x-vercel-original-url'],
        'x-original-url': req.headers['x-original-url'],
        'x-url': req.headers['x-url'],
        host: req.headers['host'],
      },
      query: req.query,
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

    const response = await app.inject({ method, url: path, headers, payload });

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
    console.error('[MatchProp handler error]', { path, method, message: msg });
    sendJson(res, 500, {
      message: 'Error interno del servidor.',
      code: 'HANDLER_ERROR',
      debug: { path, method, error: msg },
    });
  }
};
