#!/usr/bin/env node
/**
 * Cron horario: recorre todas las conexiones activas (IngestSourceConfig)
 * y ejecuta ingest con cursor (SyncWatermark) para traer nuevas propiedades
 * y actualizar precios/estado de las ya descargadas.
 *
 * Uso: pnpm --filter api ingest:cron
 * Programar cada hora: 0 * * * * (cron) o Vercel Cron.
 */
import 'dotenv/config';
import { getActiveIngestSources } from '../services/ingest/active-sources.js';
import { runIngest } from '../services/ingest/index.js';

async function main() {
  const sources = await getActiveIngestSources();
  if (sources.length === 0) {
    console.log('No hay conexiones activas configuradas (IngestSourceConfig o env).');
    return;
  }

  console.log(`Ingest cron: ${sources.length} conexión(es) activa(s).`);

  for (const { source, key } of sources) {
    try {
      const result = await runIngest({ source, limit: 200 });
      console.log(
        `  ${key} (${source}): ${result.inserted} listings, nextCursor=${result.nextCursor ?? 'null'}`
      );
    } catch (err) {
      console.error(`  ${key} (${source}): ERROR`, err);
    }
  }

  console.log('Ingest cron listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
