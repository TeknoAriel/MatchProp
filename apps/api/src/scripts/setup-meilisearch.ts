/**
 * Script para configurar y sincronizar Meilisearch.
 * 
 * Uso:
 *   MEILISEARCH_HOST=https://... MEILISEARCH_API_KEY=... npx tsx src/scripts/setup-meilisearch.ts
 * 
 * Prerequisitos:
 *   1. Crear cuenta en https://cloud.meilisearch.com (tier gratis: 10K docs)
 *   2. Obtener Host URL y API Key
 */
import { prisma } from '../lib/prisma.js';
import {
  isMeilisearchConfigured,
  getListingsIndex,
  setupListingsIndex,
  MeiliListingDocument,
} from '../lib/meilisearch.js';

async function syncListings(batchSize = 500) {
  const index = getListingsIndex();
  if (!index) {
    console.error('Meilisearch index not available');
    return 0;
  }

  let cursor: string | undefined;
  let totalSynced = 0;

  console.log('Fetching listings from database...');

  while (true) {
    const listings = await prisma.listing.findMany({
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        operationType: true,
        propertyType: true,
        price: true,
        currency: true,
        bedrooms: true,
        bathrooms: true,
        areaTotal: true,
        locationText: true,
        addressText: true,
        heroImageUrl: true,
        lat: true,
        lng: true,
        status: true,
        source: true,
        lastSeenAt: true,
      },
      orderBy: { id: 'asc' },
    });

    if (listings.length === 0) break;

    const docs: MeiliListingDocument[] = listings.map(l => ({
      id: l.id,
      title: l.title,
      description: l.description,
      operationType: l.operationType,
      propertyType: l.propertyType,
      price: l.price,
      currency: l.currency,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      areaTotal: l.areaTotal,
      locationText: l.locationText,
      addressText: l.addressText,
      heroImageUrl: l.heroImageUrl,
      lat: l.lat,
      lng: l.lng,
      status: l.status,
      source: l.source,
      lastSeenAt: l.lastSeenAt.getTime(),
    }));

    const task = await index.addDocuments(docs, { primaryKey: 'id' });
    totalSynced += docs.length;
    cursor = listings[listings.length - 1].id;

    process.stdout.write(`\rSynced ${totalSynced} listings (task ${task.taskUid})...`);
  }

  console.log('\n');
  return totalSynced;
}

async function main() {
  console.log('=== Meilisearch Setup ===\n');

  if (!isMeilisearchConfigured()) {
    console.error('ERROR: Meilisearch no está configurado.');
    console.error('');
    console.error('Pasos para configurar:');
    console.error('1. Crear cuenta gratis en https://cloud.meilisearch.com');
    console.error('2. Crear un proyecto');
    console.error('3. Copiar Host URL y API Key');
    console.error('4. Ejecutar:');
    console.error('');
    console.error('   MEILISEARCH_HOST="https://ms-xxx.meilisearch.com" \\');
    console.error('   MEILISEARCH_API_KEY="your_api_key" \\');
    console.error('   npx tsx src/scripts/setup-meilisearch.ts');
    console.error('');
    process.exit(1);
  }

  console.log('1. Configurando índice...');
  await setupListingsIndex();

  console.log('2. Sincronizando listings...');
  const count = await syncListings();

  console.log(`✓ Setup completado!`);
  console.log(`  - Documentos indexados: ${count}`);
  console.log('');
  console.log('Próximos pasos:');
  console.log('  1. Agregar variables a Vercel:');
  console.log('     MEILISEARCH_HOST=...');
  console.log('     MEILISEARCH_API_KEY=...');
  console.log('  2. Re-deployar');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
