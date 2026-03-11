#!/usr/bin/env node
/**
 * Reset + seed dataset demo determinístico.
 * Borra listings (y dependientes por cascade) e inserta mínimo 500 válidos.
 * Sprint 11: crea búsquedas activas y backfill de matches para demo visible.
 * Solo en DEMO_MODE. Ejecutar: DEMO_MODE=1 pnpm --filter api demo:reset-and-seed
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { recordMatchesForListing } from '../services/crm-push/record-matches.js';

const SOURCE = 'API_PARTNER_1' as const;
// Fotos de propiedades: Picsum con seed por listing (imagen distinta por propiedad)
const DEMO_PHOTOS_BASE = 'https://picsum.photos/seed';
const DEMO_MEDIA_PER_LISTING = 4;
const PRO_COUNT_DEFAULT = 200;

const LOCATIONS = [
  'Rosario, zona centro',
  'Rosario, barrio Pichincha',
  'Rosario, zona norte',
  'Funes, Santa Fe',
  'Funes, 400m2',
  'Zona norte, CABA',
  'Centro, Rosario',
  'Pichincha, Rosario',
  'Barrio Martin, Rosario',
  'Recoleta, CABA',
  'Palermo, centro',
  'Cerca facultad, Rosario',
];
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'LAND', 'APARTMENT', 'APARTMENT'] as const;
const OPERATIONS = ['SALE', 'RENT', 'SALE', 'RENT', 'SALE'] as const;
const BEDROOMS = [0, 1, 2, 2, 3, 1, 2, 3] as const;
const CURRENCIES = ['USD', 'ARS', 'USD', 'ARS', 'USD'] as const;
const PRICES_USD = [60000, 80000, 100000, 120000, 150000, 200000];
const PRICES_ARS = [500000, 700000, 900000, 1200000, 1500000];
const MIN_SEARCHES = 50;
const BACKFILL_SAMPLE = 25;

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(seededRandom(seed) * arr.length)]!;
}

async function main() {
  if (process.env.DEMO_MODE !== '1') {
    console.error('DEMO_MODE=1 requerido');
    process.exit(1);
  }

  console.log(
    'Demo reset: borrando ListingMatchCandidate, CrmPushOutbox, MatchEvent, demo searches y listings...'
  );
  await prisma.listingMatchCandidate.deleteMany({});
  await prisma.matchEvent.deleteMany({});
  await prisma.crmPushOutbox.deleteMany({});
  const delSearches = await prisma.savedSearch.deleteMany({
    where: { name: { startsWith: 'Demo search ' } },
  });
  console.log(`Demo searches borrados: ${delSearches.count}`);
  const deleted = await prisma.listing.deleteMany({});
  console.log(`Listings borrados: ${deleted.count}`);

  const count = Math.max(
    200,
    parseInt(process.env.DEMO_LISTINGS_COUNT || String(PRO_COUNT_DEFAULT), 10) || PRO_COUNT_DEFAULT
  );
  const now = new Date();

  console.log(`Demo seed: insertando ${count} listings (source=${SOURCE})...`);

  for (let i = 1; i <= count; i++) {
    const extId = `demo-${String(i).padStart(4, '0')}`;
    const seed = i * 7919;

    const locationText = pick(LOCATIONS, seed);
    const propertyType = pick(PROPERTY_TYPES, seed);
    const operationType = pick(OPERATIONS, seed);
    const bedrooms = pick(BEDROOMS, seed);
    const currency = pick(CURRENCIES, seed);
    const price = currency === 'USD' ? pick(PRICES_USD, seed + 1) : pick(PRICES_ARS, seed + 2);
    const bathrooms = Math.min(bedrooms + 1, 3);
    const areaTotal = 60 + Math.floor(seededRandom(seed + 3) * 140);
    const areaCovered = Math.floor(areaTotal * (0.6 + seededRandom(seed + 4) * 0.3));
    const lat = -34.6 + seededRandom(seed + 5) * 0.8;
    const lng = -58.5 + seededRandom(seed + 6) * 1.2;
    const coverUrl = `${DEMO_PHOTOS_BASE}/${seed}/800/600`;
    const title = `${propertyType} ${bedrooms} amb ${locationText}`.trim() || 'Propiedad en venta';

    const description = `${propertyType} ${bedrooms} amb en ${locationText}. ${operationType === 'SALE' ? 'Excelente oportunidad de compra' : 'Alquiler disponible'}. Superficie total ${areaTotal}m².`;
    const allAmenities = ['SUM', 'quincho', 'parrilla', 'pileta', 'cochera', 'seguridad 24h'];
    const nAmenities = Math.floor(seededRandom(seed + 10) * 3);
    const amenities = Array.from({ length: nAmenities }, (_, k) =>
      pick(allAmenities, seed + 11 + k)
    ).filter((a, i, arr) => arr.indexOf(a) === i);
    const details: Record<string, unknown> = {
      amenities,
      services: ['gas natural', 'agua caliente', 'calefacción'],
      aptoCredito: seededRandom(seed + 13) > 0.6,
    };

    const addressText = `${pick(['Av.', 'Calle', 'Bv.'], seed + 7)} ${Math.floor(seededRandom(seed + 8) * 5000)} ${locationText}`;

    const listing = await prisma.listing.create({
      data: {
        source: SOURCE,
        externalId: extId,
        status: 'ACTIVE',
        title: title || 'Sin título',
        description: description.slice(0, 500),
        details: details as object,
        operationType,
        propertyType,
        currency,
        price,
        bedrooms,
        bathrooms,
        areaTotal,
        areaCovered,
        lat,
        lng,
        addressText: addressText.slice(0, 200),
        locationText: locationText.slice(0, 200),
        heroImageUrl: coverUrl,
        photosCount: DEMO_MEDIA_PER_LISTING,
        lastSyncedAt: now,
        lastSeenAt: now,
      },
    });

    for (let m = 0; m < DEMO_MEDIA_PER_LISTING; m++) {
      const mediaSeed = seed + (m + 1) * 997;
      await prisma.listingMedia.create({
        data: {
          listingId: listing.id,
          url: `${DEMO_PHOTOS_BASE}/${mediaSeed}/800/600`,
          type: 'PHOTO',
          sortOrder: m,
        },
      });
    }
  }

  const total = await prisma.listing.count({ where: { status: 'ACTIVE' } });
  console.log(`DEMO LISTINGS READY: total=${total}`);

  // Sprint 11: búsquedas activas para matches visibles
  const users = await prisma.user.findMany({ take: 20, select: { id: true } });
  if (users.length === 0) {
    console.error('No hay usuarios. Ejecutá: pnpm --filter api exec prisma db seed');
    process.exit(1);
  }

  const searchCount = Math.max(MIN_SEARCHES, Math.min(200, users.length * 10));
  console.log(`Demo seed: creando ${searchCount} búsquedas activas...`);

  for (let i = 0; i < searchCount; i++) {
    const user = users[i % users.length]!;
    const seed = (i + 1) * 7907;
    const operationType = pick(OPERATIONS, seed);
    const propertyType = pick(PROPERTY_TYPES, seed);
    const currency = pick(CURRENCIES, seed + 1);
    const pMin = currency === 'USD' ? pick(PRICES_USD, seed + 2) : pick(PRICES_ARS, seed + 3);
    const pMax = currency === 'USD' ? pick(PRICES_USD, seed + 4) : pick(PRICES_ARS, seed + 5);
    const priceMin = Math.min(pMin, pMax) * 0.7;
    const priceMax = Math.max(pMin, pMax) * 1.3;
    const loc = pick(LOCATIONS, seed + 6);
    const filters = {
      operationType,
      propertyType: [propertyType],
      priceMin: Math.round(priceMin),
      priceMax: Math.round(priceMax),
      currency,
      bedroomsMin: pick(BEDROOMS, seed + 7),
      locationText: seededRandom(seed + 8) > 0.5 ? loc.split(',')[0]?.trim() || loc : undefined,
    };
    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name: `Demo search ${i + 1}`,
        queryText: null,
        filtersJson: filters as object,
      },
    });
  }

  const totalSearches = await prisma.savedSearch.count();
  console.log(`DEMO SEARCHES READY: total=${totalSearches}`);

  // Asignar búsquedas activas a usuarios (para reverse-matching: onlyActiveSearches)
  const demoSearches = await prisma.savedSearch.findMany({
    where: { name: { startsWith: 'Demo search ' } },
    take: users.length,
    select: { id: true },
  });
  for (let i = 0; i < users.length; i++) {
    const search = demoSearches[i % demoSearches.length];
    if (search) {
      await prisma.user.update({
        where: { id: users[i]!.id },
        data: { activeSearchId: search.id },
      });
    }
  }
  console.log(`DEMO: ${users.length} usuarios con búsqueda activa`);

  // Backfill: computar matches para una muestra de listings (solo búsquedas activas)
  const sampleListings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    take: BACKFILL_SAMPLE,
    select: { id: true },
    skip: 0,
  });
  let backfillWithMatches = 0;
  for (const l of sampleListings) {
    const { matchesCount } = await recordMatchesForListing(l.id, 'DEMO', {
      onlyActiveSearches: true,
      enqueueCrm: false,
    });
    if (matchesCount > 0) backfillWithMatches++;
  }
  console.log(
    `DEMO BACKFILL: ${sampleListings.length} listings, ${backfillWithMatches} con matches`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
