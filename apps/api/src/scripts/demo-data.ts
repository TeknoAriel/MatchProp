/**
 * Dataset demo determinístico para dev.
 * Sin internet. Inserta N listings con variedad para cubrir búsquedas típicas.
 * Ejecutar: pnpm --filter api demo:data
 * Cantidad: DEMO_LISTINGS_COUNT (default 500) o --count=N
 */
import { prisma } from '../lib/prisma.js';

const SOURCE = 'API_PARTNER_1' as const;
const DEMO_PHOTOS_BASE = '/demo/photos';
const DEMO_PHOTO_COUNT = 50;
const DEMO_MEDIA_PER_LISTING = 5;

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

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(seededRandom(seed) * arr.length)]!;
}

function parseCount(): number {
  const env = process.env.DEMO_LISTINGS_COUNT;
  if (env) {
    const n = parseInt(env, 10);
    if (!Number.isNaN(n) && n > 0) return Math.min(n, 5000);
  }
  const arg = process.argv.find((a) => a.startsWith('--count='));
  if (arg) {
    const n = parseInt(arg.split('=')[1] ?? '', 10);
    if (!Number.isNaN(n) && n > 0) return Math.min(n, 5000);
  }
  return 500;
}

async function main() {
  const count = parseCount();
  const now = new Date();

  console.log(`Demo: insertando ${count} listings (source=${SOURCE})...`);

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

    const photoNum = ((i - 1) % DEMO_PHOTO_COUNT) + 1;
    const photoName = `photo-${String(photoNum).padStart(2, '0')}.svg`;
    const coverUrl = `${DEMO_PHOTOS_BASE}/${photoName}`;

    const listing = await prisma.listing.upsert({
      where: {
        source_externalId: { source: SOURCE, externalId: extId },
      },
      create: {
        source: SOURCE,
        externalId: extId,
        status: 'ACTIVE',
        title: `${propertyType} ${bedrooms} amb ${locationText}`,
        operationType,
        propertyType,
        currency,
        price,
        bedrooms,
        bathrooms,
        areaTotal,
        locationText: locationText.slice(0, 200),
        heroImageUrl: coverUrl,
        photosCount: DEMO_MEDIA_PER_LISTING,
        lastSyncedAt: now,
        lastSeenAt: now,
      },
      update: {
        status: 'ACTIVE',
        title: `${propertyType} ${bedrooms} amb ${locationText}`,
        operationType,
        propertyType,
        currency,
        price,
        bedrooms,
        bathrooms,
        areaTotal,
        locationText: locationText.slice(0, 200),
        heroImageUrl: coverUrl,
        photosCount: DEMO_MEDIA_PER_LISTING,
        lastSyncedAt: now,
        lastSeenAt: now,
      },
    });

    await prisma.listingMedia.deleteMany({ where: { listingId: listing.id } });
    for (let m = 0; m < DEMO_MEDIA_PER_LISTING; m++) {
      const mNum = ((i - 1 + m) % DEMO_PHOTO_COUNT) + 1;
      const mName = `photo-${String(mNum).padStart(2, '0')}.svg`;
      await prisma.listingMedia.create({
        data: {
          listingId: listing.id,
          url: `${DEMO_PHOTOS_BASE}/${mName}`,
          type: 'PHOTO',
          sortOrder: m,
        },
      });
    }
  }

  const total = await prisma.listing.count({ where: { source: SOURCE } });
  console.log(`Demo: listo. Total API_PARTNER_1: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
