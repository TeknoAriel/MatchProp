/**
 * Script para poblar ListingMedia con las fotos del JSON de origen.
 * Uso: npx tsx src/scripts/migrate-photos.ts
 */
import { prisma } from '../lib/prisma.js';

const YUMBLIN_URL =
  'https://static.kiteprop.com/kp/difusions/23705a4a85ab8f1d301c73aae5359a81a8b5c1ca/yumblin.json';

const EXTERNALSITE_URL =
  'https://static.kiteprop.com/kp/externalsite/f27ae1a1b0ff5b8bc4b5e2b2a1c8c9d3e4f5a6b7/properties.json';

interface RawListing {
  id: number | string;
  images?: { url?: string; title?: string | null; blueprint?: boolean }[];
}

async function fetchYumblin(): Promise<RawListing[]> {
  console.log('Descargando Yumblin...');
  const res = await fetch(YUMBLIN_URL);
  if (!res.ok) throw new Error(`Yumblin fetch failed: ${res.status}`);
  const data = await res.json();
  console.log(`Yumblin: ${data.length} propiedades`);
  return data;
}

async function fetchExternalsite(): Promise<RawListing[]> {
  try {
    console.log('Descargando Externalsite...');
    const res = await fetch(EXTERNALSITE_URL);
    if (!res.ok) {
      console.log('Externalsite no disponible, usando solo Yumblin');
      return [];
    }
    const data = await res.json();
    console.log(`Externalsite: ${data.length} propiedades`);
    return data;
  } catch {
    console.log('Externalsite no disponible');
    return [];
  }
}

async function main() {
  console.log('=== Migración de fotos a ListingMedia ===\n');

  // 1. Cargar datos de origen
  const [yumblin, externalsite] = await Promise.all([
    fetchYumblin(),
    fetchExternalsite()
  ]);

  // 2. Crear mapa de externalId -> imágenes
  const imageMap = new Map<string, { url: string; sortOrder: number }[]>();

  for (const raw of [...yumblin, ...externalsite]) {
    const id = String(raw.id);
    const images = (raw.images ?? [])
      .filter((img): img is { url: string } => !!img?.url)
      .map((img, i) => ({ url: img.url, sortOrder: i }));
    if (images.length > 0) {
      imageMap.set(id, images);
    }
  }

  console.log(`\nMapa de imágenes creado: ${imageMap.size} propiedades con fotos`);

  // 3. Obtener listings de la BD
  const listings = await prisma.listing.findMany({
    select: { id: true, externalId: true, heroImageUrl: true },
    where: {
      OR: [
        { source: 'KITEPROP_DIFUSION_YUMBLIN' },
        { source: 'KITEPROP_EXTERNALSITE' }
      ]
    }
  });

  console.log(`Listings en BD: ${listings.length}`);

  // 4. Borrar media existente (por si acaso)
  const deletedMedia = await prisma.listingMedia.deleteMany({});
  console.log(`Media existente borrado: ${deletedMedia.count}`);

  // 5. Insertar fotos en batches
  let totalInserted = 0;
  let listingsUpdated = 0;
  const batchSize = 100;

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
      await prisma.listingMedia.createMany({ data: mediaToCreate });
      totalInserted += mediaToCreate.length;
    }

    process.stdout.write(`\rProgreso: ${Math.min(i + batchSize, listings.length)}/${listings.length} listings, ${totalInserted} fotos insertadas`);
  }

  console.log('\n');

  // 6. Actualizar heroImageUrl donde falta
  const withoutHero = await prisma.listing.count({ where: { heroImageUrl: null } });
  console.log(`Listings sin heroImageUrl: ${withoutHero}`);

  // 7. Stats finales
  const finalMediaCount = await prisma.listingMedia.count();
  console.log(`\n=== Resultado ===`);
  console.log(`Total fotos en ListingMedia: ${finalMediaCount}`);
  console.log(`Listings actualizados: ${listingsUpdated}`);
  console.log(`Promedio fotos/listing: ${(finalMediaCount / listingsUpdated).toFixed(1)}`);

  await prisma.$disconnect();
}

main().catch(console.error);
