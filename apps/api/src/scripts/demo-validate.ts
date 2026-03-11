#!/usr/bin/env node
/**
 * Valida dataset demo PRO: total >= 200, totalSearches >= 50, al menos 10 listings con matches.
 * Ejecutar: pnpm --filter api demo:validate
 * Exit 1 si falla.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const MIN_TOTAL = 200;
const MIN_SEARCHES = 50;
const MIN_LISTINGS_WITH_MATCHES = 10;
const SAMPLE_SIZE = 20;

async function main() {
  const total = await prisma.listing.count({ where: { status: 'ACTIVE' } });
  if (total < MIN_TOTAL) {
    console.error(`DEMO VALIDATE FAIL: total=${total} < ${MIN_TOTAL}`);
    process.exit(1);
  }

  const badIds = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ id: '' }, { id: 'undefined' }, { id: 'null' }],
    },
    select: { id: true },
    take: 5,
  });
  if (badIds.length > 0) {
    console.error(
      `DEMO VALIDATE FAIL: items con id inválido: ${badIds.map((l) => l.id).join(', ')}`
    );
    process.exit(1);
  }

  const emptyHero = await prisma.listing.count({
    where: {
      status: 'ACTIVE',
      OR: [{ heroImageUrl: null }, { heroImageUrl: '' }],
    },
  });
  if (emptyHero > total * 0.1) {
    console.error(`DEMO VALIDATE FAIL: ${emptyHero} items sin heroImageUrl (>10% de ${total})`);
    process.exit(1);
  }

  const emptyTitle = await prisma.listing.count({
    where: {
      status: 'ACTIVE',
      OR: [{ title: null }, { title: '' }],
    },
  });
  if (emptyTitle > total * 0.05) {
    console.error(`DEMO VALIDATE FAIL: ${emptyTitle} items sin title (>5% de ${total})`);
    process.exit(1);
  }

  const totalSearches = await prisma.savedSearch.count();
  if (totalSearches < MIN_SEARCHES) {
    console.error(`DEMO VALIDATE FAIL: totalSearches=${totalSearches} < ${MIN_SEARCHES}`);
    process.exit(1);
  }

  const sample = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    take: SAMPLE_SIZE,
    select: { id: true },
  });
  let withMatches = 0;
  for (const l of sample) {
    const candidates = await prisma.listingMatchCandidate.count({
      where: { listingId: l.id },
    });
    if (candidates >= 1) withMatches++;
  }
  if (withMatches < MIN_LISTINGS_WITH_MATCHES) {
    console.error(
      `DEMO VALIDATE FAIL: solo ${withMatches}/${SAMPLE_SIZE} listings con matches (mín ${MIN_LISTINGS_WITH_MATCHES})`
    );
    process.exit(1);
  }

  console.log(
    `DEMO VALIDATE OK: total=${total} searches=${totalSearches} withMatches>=${MIN_LISTINGS_WITH_MATCHES}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
