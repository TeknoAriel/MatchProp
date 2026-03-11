#!/usr/bin/env node
/**
 * Mock webhook CRM local para auditoría: recibe POST /webhook y responde 200.
 * Uso: pnpm mock:crm
 * Luego: CRM_WEBHOOK_URL=http://localhost:9999/webhook pnpm --filter api crm:push:run
 */
const PORT = Number(process.env.PORT) || 9999;

const server = require('http').createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const slice = body.slice(0, 500);
      console.log('[mock-crm] POST /webhook', req.headers['authorization'] ? 'Authorization: ***' : '', 'body:', slice);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Mock CRM webhook: http://localhost:${PORT}/webhook`);
  console.log('Para probar: CRM_WEBHOOK_URL=http://localhost:' + PORT + '/webhook pnpm --filter api crm:push:run');
});
