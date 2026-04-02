import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_PROPERTIES = Math.max(0, parseInt(process.env.SEED_PROPERTIES || '10000', 10));
const SEED_USERS = Math.max(0, parseInt(process.env.SEED_USERS || '50', 10));
const SWIPE_RATIO = Math.min(1, Math.max(0, parseFloat(process.env.SWIPE_RATIO || '0.5')));
const SEED_RESET = process.env.SEED_RESET !== '0';
const LOAD_USER_PREFIX = process.env.LOAD_USER_PREFIX || 'loaduser';
const LOAD_USER_PASSWORD = process.env.LOAD_USER_PASSWORD || 'demo';
const CONTROL_EMAIL = process.env.CONTROL_EMAIL || 'load@matchprop.com';

const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;
const OPERATIONS = ['SALE', 'RENT'] as const;
const CURRENCIES = ['USD', 'ARS'] as const;
const LOCATIONS = ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata'];
const BATCH_PROPERTIES = 500;
const BATCH_SWIPES = 5000;

function pad3(n: number) {
  return String(n).padStart(3, '0');
}

function shouldSwipe(userIdx: number, propIdx: number): boolean {
  const h = (userIdx * 31 + propIdx) % 1000;
  return h < SWIPE_RATIO * 1000;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  const start = Date.now();
  console.log('Seeding database...');
  console.log(
    `Config: properties=${SEED_PROPERTIES}, users=${SEED_USERS}, swipeRatio=${SWIPE_RATIO}, reset=${SEED_RESET}`
  );

  const passwordHash = await bcrypt.hash('demo', 10);
  const loadPasswordHash = await bcrypt.hash(LOAD_USER_PASSWORD, 10);
  const adminKitePropHash = await bcrypt.hash('KiteProp123', 10);

  if (SEED_RESET) {
    const controlUser = await prisma.user.findUnique({ where: { email: CONTROL_EMAIL } });
    const loadUsers = await prisma.user.findMany({
      where: { email: { startsWith: `${LOAD_USER_PREFIX}+` } },
      select: { id: true },
    });
    const userIds = [...(controlUser ? [controlUser.id] : []), ...loadUsers.map((u) => u.id)];
    if (userIds.length > 0) {
      await prisma.swipe.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.preference.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`Reset: deleted swipes/prefs for ${userIds.length} users`);
    }
    const deletedProps = await prisma.property.deleteMany({
      where: { title: { startsWith: 'SeedProp ' } },
    });
    console.log(`Reset: deleted ${deletedProps.count} SeedProp properties`);
  }

  await prisma.user.upsert({
    where: { email: 'admin@matchprop.com' },
    create: { email: 'admin@matchprop.com', passwordHash, role: 'ADMIN' },
    update: { passwordHash },
  });
  const KITEPROP_ADMINS = [
    'ariel@kiteprop.com',
    'jonas@kiteprop.com',
    'soporte@kiteprop.com',
  ] as const;
  for (const email of KITEPROP_ADMINS) {
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: adminKitePropHash, role: 'ADMIN' },
      update: { passwordHash: adminKitePropHash, role: 'ADMIN' },
    });
  }
  console.log(`Kiteprop admins ready (${KITEPROP_ADMINS.join(', ')}); rol ADMIN habilitado.`);
  const agent = await prisma.user.upsert({
    where: { email: 'demo@matchprop.com' },
    create: { email: 'demo@matchprop.com', passwordHash, role: 'AGENT' },
    update: { passwordHash },
  });
  console.log(`Admin/demo ready`);

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const control = await prisma.user.upsert({
    where: { email: CONTROL_EMAIL },
    create: {
      email: CONTROL_EMAIL,
      passwordHash: loadPasswordHash,
      role: 'AGENT',
      premiumUntil: thirtyDaysFromNow,
    },
    update: { passwordHash: loadPasswordHash, premiumUntil: thirtyDaysFromNow },
  });
  console.log(`Control user (sin swipes, premium demo): ${control.email}`);

  const smokeUser = await prisma.user.upsert({
    where: { email: 'smoke-ux@matchprop.com' },
    create: {
      email: 'smoke-ux@matchprop.com',
      passwordHash,
      role: 'BUYER',
      premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: { premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  console.log(`Smoke user (premium demo): ${smokeUser.email}`);

  const loadUserEmails = Array.from(
    { length: SEED_USERS },
    (_, i) => `${LOAD_USER_PREFIX}+${pad3(i + 1)}@matchprop.com`
  );
  const loadUsers: { id: string; email: string }[] = [];
  for (const email of loadUserEmails) {
    const u = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: loadPasswordHash, role: 'AGENT' },
      update: { passwordHash: loadPasswordHash },
    });
    loadUsers.push(u);
  }
  console.log(`Load users: ${loadUsers.length}`);

  const seedPropCount = await prisma.property.count({
    where: { title: { startsWith: 'SeedProp ' } },
  });
  const toCreate = Math.max(0, SEED_PROPERTIES - seedPropCount);
  if (toCreate > 0) {
    for (let offset = 0; offset < toCreate; offset += BATCH_PROPERTIES) {
      const batchSize = Math.min(BATCH_PROPERTIES, toCreate - offset);
      const batch = Array.from({ length: batchSize }, (_, i) => {
        const idx = offset + i;
        const op = randomChoice(OPERATIONS);
        const price =
          op === 'SALE'
            ? randomInt(50000, 500000) * (randomChoice(CURRENCIES) === 'USD' ? 1000 : 1)
            : randomInt(50, 500) * (randomChoice(CURRENCIES) === 'USD' ? 100 : 1);
        return {
          title: `SeedProp ${idx}`,
          description: `Descripción seed ${idx}.`,
          price,
          currency: randomChoice(CURRENCIES),
          locationText: randomChoice(LOCATIONS),
          lat: -34.6 + Math.random() * 2,
          lng: -58.5 + Math.random() * 2,
          bedrooms: randomInt(1, 4),
          bathrooms: randomInt(1, 2),
          areaM2: randomInt(50, 200),
          operation: op,
          propertyType: randomChoice(PROPERTY_TYPES),
          photos: [`https://picsum.photos/seed/s${idx}/800/600`],
          createdById: agent.id,
        };
      });
      await prisma.property.createMany({ data: batch });
      if ((offset + batchSize) % 2000 === 0 || offset + batchSize === toCreate) {
        console.log(`Properties: ${offset + batchSize}/${toCreate}`);
      }
    }
  }

  const allProps = await prisma.property.findMany({
    where: { title: { startsWith: 'SeedProp ' } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const propIds = allProps.map((p) => p.id);
  const totalProps = propIds.length;
  console.log(`Total SeedProp properties: ${totalProps}`);

  let totalSwipes = 0;
  for (let u = 0; u < loadUsers.length; u++) {
    const userId = loadUsers[u]!.id;
    const batch: { userId: string; propertyId: string; direction: 'DISLIKE' }[] = [];
    for (let p = 0; p < totalProps; p++) {
      if (shouldSwipe(u, p)) {
        batch.push({ userId, propertyId: propIds[p]!, direction: 'DISLIKE' });
      }
    }
    for (let i = 0; i < batch.length; i += BATCH_SWIPES) {
      const chunk = batch.slice(i, i + BATCH_SWIPES);
      await prisma.swipe.createMany({ data: chunk, skipDuplicates: true });
      totalSwipes += chunk.length;
    }
    if ((u + 1) % 10 === 0 || u === loadUsers.length - 1) {
      console.log(`Swipes: user ${u + 1}/${loadUsers.length}`);
    }
  }
  console.log(`Total swipes created: ${totalSwipes}`);

  const defaultIngestSources = {
    externalsite: [
      {
        url: 'https://static.kiteprop.com/kp/difusions/2a41bc8d62be280eacbcb8ac2c5ff6c51dc39af2/proppit.json',
        format: 'json',
      },
    ],
    properstar: [
      {
        url: 'https://static.kiteprop.com/kp/difusions/f89cbd8ca785fc34317df63d29ab8ea9d68a7b1c/properstar.json',
        format: 'json',
      },
    ],
    icasas: [
      {
        url: 'https://www.kiteprop.com/difusions/icasas',
        format: 'json',
      },
    ],
    zonaprop: [
      {
        url: 'https://static.kiteprop.com/kp/difusions/13d87da051c790afaf09c7afd094f151d7d06290/zonaprop.xml',
        format: 'xml',
      },
    ],
  };
  await prisma.ingestSourceConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', sourcesJson: defaultIngestSources },
    update: { sourcesJson: defaultIngestSources },
  });
  console.log('IngestSourceConfig (externalsite, properstar, icasas, zonaprop) seeded');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('---');
  console.log(`Seed completed in ${elapsed}s`);
  console.log(`  properties: ${totalProps}`);
  console.log(`  load users: ${loadUsers.length}`);
  console.log(`  swipes: ${totalSwipes}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
