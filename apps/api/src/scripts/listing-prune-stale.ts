#!/usr/bin/env node
/**
 * Marca INACTIVE listings alineados con listing-quality-where (feed):
 * - createdAt anterior a FEED_MAX_LISTING_AGE_YEARS (default 4), o
 * - sin señal visual: photosCount 0, sin filas en media, hero vacío/null.
 *
 * Tras un ingest manual, ejecutar: pnpm --filter api listing:prune-stale
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

import { prisma } from '../lib/prisma.js';
import { listingMinCreatedAt } from '../lib/listing-quality-where.js';

async function main() {
  const since = listingMinCreatedAt();
  const noVisual = {
    AND: [
      { photosCount: 0 },
      { media: { none: {} } },
      {
        OR: [{ heroImageUrl: null }, { heroImageUrl: '' }],
      },
    ],
  };

  const result = await prisma.listing.updateMany({
    where: {
      status: 'ACTIVE',
      OR: [{ createdAt: { lt: since } }, noVisual],
    },
    data: { status: 'INACTIVE' },
  });
  console.log(`listing-prune-stale: ${result.count} listings marcados INACTIVE`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
