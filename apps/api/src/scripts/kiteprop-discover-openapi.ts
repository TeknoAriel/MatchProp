#!/usr/bin/env tsx
/**
 * Kiteprop OpenAPI auto-discover.
 * Abre la doc en Playwright, captura requests y busca openapi/swagger spec.
 * Uso: pnpm --filter api kiteprop:discover
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DOC_URL = 'https://www.kiteprop.com/docs/api/v1/';
const SPEC_PATTERNS = [
  /openapi\.json$/i,
  /swagger\.json$/i,
  /api-docs$/i,
  /openapi\.yaml$/i,
  /swagger\.yaml$/i,
];

async function main() {
  const docsDir = join(process.cwd(), '..', '..', 'docs');
  mkdirSync(docsDir, { recursive: true });

  let specUrl: string | null = null;
  let specContent: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  context.route('**/*', async (route) => {
    const url = route.request().url();
    if (SPEC_PATTERNS.some((p) => p.test(url))) {
      try {
        const res = await route.fetch();
        specContent = await res.text();
        specUrl = url;
        await route.fulfill({
          status: res.status,
          headers: res.headers,
          body: specContent,
        });
        return;
      } catch {
        // fall through to continue
      }
    }
    await route.continue();
  });

  const page = await context.newPage();
  try {
    await page.goto(DOC_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch {
    // timeout ok, we might have captured the spec
  }

  await browser.close();

  if (specUrl && specContent) {
    const outPath = join(docsDir, 'kiteprop-openapi.json');
    let json: unknown;
    try {
      json = JSON.parse(specContent);
    } catch {
      json = { _raw: specContent };
    }
    writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf-8');
    const servers = (json as { servers?: Array<{ url: string }> })?.servers;
    const baseUrl = servers?.[0]?.url ?? new URL(specUrl).origin;
    console.log('SPEC_URL encontrada:', specUrl);
    console.log('Base URL (servers[0]):', baseUrl);
    console.log('Guardado en:', outPath);
  } else {
    console.log(`
No se encontró la spec OpenAPI/Swagger automáticamente.

Instrucciones:
1. Abrí la doc en el navegador: ${DOC_URL}
2. Abrí DevTools (F12) → pestaña Network
3. Filtrá por "openapi" o "swagger"
4. Recargá la página
5. Copiá la URL del request que devuelva JSON/YAML
6. Guardá el contenido en docs/kiteprop-openapi.json manualmente
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
