#!/usr/bin/env node
/**
 * Importación manual COMPLETA desde el JSON de difusión Yumblin (Kiteprop).
 *
 * - Recorre el JSON en lotes (igual que el conector: máx. 200 ítems por evento de ingest).
 * - No modifica el cron de GitHub ni el endpoint POST /cron/ingest (ese solo usa externalsite).
 *
 * Origen del JSON:
 * - Archivo local: KITEPROP_DIFUSION_YUMBLIN_FILE=/ruta/yumblin.json
 * - O URL: KITEPROP_DIFUSION_YUMBLIN_URL=... o IngestSourceConfig (yumblin en Settings)
 *
 * Uso:
 *   pnpm --filter api ingest:yumblin:full
 *   pnpm --filter api ingest:yumblin:full -- --file=/ruta/al/archivo.json
 *   pnpm --filter api ingest:yumblin:full -- --reset
 *   pnpm --filter api ingest:yumblin:full -- --reset --file=./yumblin.json
 *
 * --reset  Borra el cursor de SyncWatermark para esta fuente y vuelve a importar desde el índice 0.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runIngest } from '../services/ingest/index.js';

const SOURCE = 'KITEPROP_DIFUSION_YUMBLIN' as const;

function parseArgs(): { reset: boolean; file: string | null; url: string | null } {
  const args = process.argv.slice(2);
  let reset = false;
  let file: string | null = null;
  let url: string | null = null;
  for (const arg of args) {
    if (arg === '--reset') reset = true;
    else if (arg.startsWith('--file=')) file = arg.slice(7).trim() || null;
    else if (arg.startsWith('--url=')) url = arg.slice(6).trim() || null;
  }
  return { reset, file, url };
}

async function main() {
  const { reset, file, url } = parseArgs();

  if (file) {
    process.env.KITEPROP_DIFUSION_YUMBLIN_FILE = file;
    delete process.env.KITEPROP_DIFUSION_YUMBLIN_URL;
  }
  if (url) {
    process.env.KITEPROP_DIFUSION_YUMBLIN_URL = url;
    delete process.env.KITEPROP_DIFUSION_YUMBLIN_FILE;
  }

  if (reset) {
    await prisma.syncWatermark.upsert({
      where: { source: SOURCE },
      create: { source: SOURCE, cursor: null },
      update: { cursor: null },
    });
    console.log(`[yumblin-full] SyncWatermark reseteado para ${SOURCE} (cursor=null).`);
  }

  const origin =
    process.env.KITEPROP_DIFUSION_YUMBLIN_FILE ??
    process.env.KITEPROP_DIFUSION_YUMBLIN_URL ??
    '(IngestSourceConfig yumblin o URL por defecto)';

  console.log(`[yumblin-full] Origen: ${origin}`);
  console.log(`[yumblin-full] Importación por lotes hasta agotar el JSON (no afecta al cron).`);

  const maxBatches = 50000;
  let batch = 0;
  let lastCursor: string | null = null;

  for (;;) {
    if (batch >= maxBatches) {
      console.error('[yumblin-full] Abortado: demasiados lotes (revisar watermark o datos).');
      process.exit(1);
    }
    batch += 1;
    const result = await runIngest({ source: SOURCE, limit: 200 });
    lastCursor = result.nextCursor ?? null;
    console.log(
      `[yumblin-full] Lote ${batch}: total listings con source=${SOURCE} en DB=${result.inserted}, nextCursor=${lastCursor ?? 'null'}`
    );
    if (lastCursor === null) break;
  }

  console.log(`[yumblin-full] Listo. Lotes: ${batch}. Importación manual completa.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
