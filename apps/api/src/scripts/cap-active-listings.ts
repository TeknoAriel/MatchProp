#!/usr/bin/env node
/**
 * Deja como máximo N listings en estado ACTIVE; el resto pasa a INACTIVE (no borra filas).
 * Útil para aligerar catálogo en prod antes de re-ingestar.
 *
 * No arregla login por sí solo: si Prisma/DB están desalineados, primero `prisma migrate deploy`.
 *
 * Dry-run (solo informa):
 *   DATABASE_URL="..." pnpm --filter api exec tsx src/scripts/cap-active-listings.ts --keep=20
 *
 * Aplicar:
 *   DATABASE_URL="..." pnpm --filter api exec tsx src/scripts/cap-active-listings.ts --keep=20 --execute
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

import { prisma } from '../lib/prisma.js';

function parseArgs() {
  let keep = 20;
  let execute = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--keep=')) keep = Math.max(1, parseInt(a.slice('--keep='.length), 10) || 20);
    else if (a === '--execute') execute = true;
  }
  return { keep, execute };
}

async function main() {
  const { keep, execute } = parseArgs();

  const totalActive = await prisma.listing.count({ where: { status: 'ACTIVE' } });
  if (totalActive <= keep) {
    console.log(
      `cap-active-listings: ya hay ${totalActive} ACTIVE (límite ${keep}). Nada que hacer.`
    );
    return;
  }

  const toKeep = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
    take: keep,
    select: { id: true },
  });
  const keepIds = new Set(toKeep.map((r) => r.id));

  const wouldDeactivate = totalActive - keepIds.size;
  console.log(
    `cap-active-listings: ACTIVE=${totalActive}, mantener=${keep}, pasarían a INACTIVE=${wouldDeactivate}`
  );

  if (!execute) {
    console.log('Dry-run: repetí con --execute para aplicar.');
    return;
  }

  const res = await prisma.listing.updateMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: [...keepIds] },
    },
    data: { status: 'INACTIVE' },
  });
  console.log(
    `cap-active-listings: ${res.count} listings marcados INACTIVE. Quedan ${keep} ACTIVE (objetivo).`
  );

  const after = await prisma.listing.count({ where: { status: 'ACTIVE' } });
  console.log(`Verificación: ACTIVE ahora = ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
