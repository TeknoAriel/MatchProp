#!/usr/bin/env node
/**
 * Ingest manual (beta): KITEPROP_EXTERNALSITE y API_PARTNER_1, 500 ítems cada uno.
 * Uso: pnpm --filter api ingest:manual
 */
import 'dotenv/config';
import { runIngest } from '../services/ingest/index.js';
import type { ListingSource } from '@prisma/client';

const LIMIT = 500;
const SOURCES: ListingSource[] = ['KITEPROP_EXTERNALSITE', 'API_PARTNER_1'];

async function main() {
  for (const source of SOURCES) {
    console.log(`Ingest: source=${source} limit=${LIMIT}`);
    const result = await runIngest({ source, limit: LIMIT });
    console.log(
      `Done ${source}: ${result.inserted} listings, nextCursor=${result.nextCursor ?? 'null'}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
