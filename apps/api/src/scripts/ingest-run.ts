#!/usr/bin/env node
/**
 * Ejecutar: pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200
 */
import 'dotenv/config';
import { runIngest } from '../services/ingest/index.js';
import type { ListingSource } from '@prisma/client';

function parseArgs(): { source: ListingSource; limit: number } {
  const args = process.argv.slice(2);
  let source: ListingSource = 'KITEPROP_EXTERNALSITE';
  let limit = 200;
  for (const arg of args) {
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
        ].includes(val)
      ) {
        source = val as ListingSource;
      }
    } else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice(8), 10);
      if (!Number.isNaN(n) && n > 0) limit = Math.min(500, n);
    }
  }
  return { source, limit };
}

async function main() {
  const { source, limit } = parseArgs();
  console.log(`Ingest: source=${source} limit=${limit}`);
  const result = await runIngest({ source, limit });
  console.log(`Done: ${result.inserted} listings, nextCursor=${result.nextCursor ?? 'null'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
