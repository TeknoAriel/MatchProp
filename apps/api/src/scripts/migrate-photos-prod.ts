/**
 * Script para poblar ListingMedia en PRODUCCIÓN (Neon).
 * Uso: DATABASE_URL="postgresql://..." npx tsx src/scripts/migrate-photos-prod.ts
 */
import { PrismaClient } from '@prisma/client';

const YUMBLIN_URL =
  'https://static.kiteprop.com/kp/difusions/23705a4a85ab8f1d301c73aae5359a81a8b5c1ca/yumblin.json';

interface RawListing {
  id: number | string;
  images?: { url?: string; title?: string | null; blueprint?: boolean }[];
}

async function main() {
  console.log('=== Migración de fotos a ListingMedia (PRODUCCIÓN) ===\n');

  if (!process.env.DATABASE_URL?.includes('neon')) {
    console.error('ERROR: Este script es solo para producción (Neon).');
    console.error('Uso: DATABASE_URL="postgresql://...neon.tech/..." npx tsx src/scripts/migrate-photos-prod.ts');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  // 1. Cargar datos de origen
  console.log('Descargando Yumblin...');
  const res = await fetch(YUMBLIN_URL);
  if (!res.ok) throw new Error(`Yumblin fetch failed: ${res.status}`);
  const yumblin: RawListing[] = await res.json();
  console.log(`Yumblin: ${yumblin.length} propiedades`);

  // 2. Crear mapa de externalId -> imágenes
  const imageMap = new Map<string, { url: string; sortOrder: number }[]>();
  for (const raw of yumblin) {
    const id = String(raw.id);
    const images = (raw.images ?? [])
      .filter((img): img is { url: string } => !!img?.url)
      .map((img, i) => ({ url: img.url, sortOrder: i }));
    if (images.length > 0) {
      imageMap.set(id, images);
    }
  }
  console.log(`Mapa de imágenes creado: ${imageMap.size} propiedades con fotos`);

  // 3. Verificar estado actual
  const currentMediaCount = await prisma.listingMedia.count();
  console.log(`\nMedia actual en producción: ${currentMediaCount}`);

  if (currentMediaCount > 100000) {
    console.log('Ya hay muchas fotos en producción. Saltando...');
    await prisma.$disconnect();
    return;
  }

  // 4. Obtener listings de la BD
  const listings = await prisma.listing.findMany({
    select: { id: true, externalId: true },
    where: { source: 'KITEPROP_DIFUSION_YUMBLIN' }
  });
  console.log(`Listings Yumblin en BD: ${listings.length}`);

  // 5. Borrar media existente (solo si hay pocos)
  if (currentMediaCount > 0 && currentMediaCount < 10000) {
    const deletedMedia = await prisma.listingMedia.deleteMany({});
    console.log(`Media existente borrado: ${deletedMedia.count}`);
  }

  // 6. Insertar fotos en batches pequeños (para no saturar Neon)
  let totalInserted = 0;
  let listingsUpdated = 0;
  const batchSize = 50; // Más pequeño para producción

  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    const mediaToCreate: { listingId: string; url: string; type: string; sortOrder: number }[] = [];

    for (const listing of batch) {
      const images = imageMap.get(listing.externalId);
      if (images && images.length > 0) {
        for (const img of images) {
          mediaToCreate.push({
            listingId: listing.id,
            url: img.url,
            type: 'PHOTO',
            sortOrder: img.sortOrder
          });
        }
        listingsUpdated++;
      }
    }

    if (mediaToCreate.length > 0) {
      try {
        await prisma.listingMedia.createMany({ data: mediaToCreate, skipDuplicates: true });
        totalInserted += mediaToCreate.length;
      } catch (err) {
        console.error(`\nError en batch ${i}:`, err);
      }
    }

    process.stdout.write(`\rProgreso: ${Math.min(i + batchSize, listings.length)}/${listings.length} listings, ${totalInserted} fotos`);

    // Pausa para no saturar
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n');

  // 7. Stats finales
  const finalMediaCount = await prisma.listingMedia.count();
  console.log(`\n=== Resultado ===`);
  console.log(`Total fotos en ListingMedia: ${finalMediaCount}`);
  console.log(`Listings con fotos: ${listingsUpdated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
