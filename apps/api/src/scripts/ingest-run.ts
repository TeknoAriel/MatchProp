#!/usr/bin/env node
/**
 * Ejecutar: pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200
 * Catálogo Properstar (JSON grande): mismo source KITEPROP_DIFUSION_YUMBLIN, p. ej.
 *   pnpm --filter api ingest:run -- --source=KITEPROP_DIFUSION_YUMBLIN --limit=8000 --until-empty
 * Ver docs/INGEST_PROPERSTAR.md
 */
import 'dotenv/config';
import { runIngest } from '../services/ingest/index.js';
import type { ListingSource } from '@prisma/client';

function parseArgs(): { source: ListingSource; limit: number; untilEmpty: boolean } {
  const args = process.argv.slice(2);
  let source: ListingSource = 'KITEPROP_EXTERNALSITE';
  let limit = 200;
  let untilEmpty = false;
  for (const arg of args) {
    if (arg === '--until-empty') {
      untilEmpty = true;
      continue;
    }
    if (arg.startsWith('--source=')) {
      const val = arg.slice(9).toUpperCase();
      if (
        [
          'KITEPROP_EXTERNALSITE',
          'KITEPROP_API',
          'API_PARTNER_1',
          'KITEPROP_DIFUSION_ZONAPROP',
          'KITEPROP_DIFUSION_TOCTOC',
          'KITEPROP_DIFUSION_ICASAS',
          'KITEPROP_DIFUSION_YUMBLIN',
        ].includes(val)
      ) {
        source = val as ListingSource;
      }
    } else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice(8), 10);
      if (!Number.isNaN(n) && n > 0) limit = Math.min(50000, n);
    }
  }
  return { source, limit, untilEmpty };
}

async function main() {
  const { source, limit, untilEmpty } = parseArgs();
  let iteration = 0;
  const maxIterations = 5000;

  do {
    console.log(
      `Ingest batch ${iteration + 1}: source=${source} limit=${limit}${untilEmpty ? ' (until-empty)' : ''}`
    );
    const result = await runIngest({ source, limit });
    console.log(
      `  → listings con esta fuente en DB: ${result.inserted}, nextCursor=${result.nextCursor ?? 'null'}`
    );
    iteration += 1;
    if (!untilEmpty) break;
    if (result.nextCursor == null) break;
    if (iteration >= maxIterations) {
      console.error('Abort: demasiadas iteraciones (revisá cursor / límite).');
      process.exit(1);
    }
  } while (untilEmpty);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
