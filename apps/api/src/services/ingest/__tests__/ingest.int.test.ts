/**
 * Tests de integración del pipeline de ingest.
 * Ejecutar: pnpm --filter api test:all
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { runIngest } from '../index.js';

describe('Ingest integration', () => {
  beforeAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { type: 'INGEST_RUN_REQUESTED' } });
    await prisma.syncWatermark.deleteMany({});
    await prisma.listing.deleteMany({ where: { source: 'KITEPROP_EXTERNALSITE' } });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({ where: { source: 'KITEPROP_EXTERNALSITE' } });
    await prisma.syncWatermark.deleteMany({});
    await prisma.outboxEvent.deleteMany({ where: { type: 'INGEST_RUN_REQUESTED' } });
  });

  it('ingest KITEPROP_EXTERNALSITE carga datos desde fixtures', async () => {
    const r1 = await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    expect(r1.inserted).toBe(3);
    const count = await prisma.listing.count({ where: { source: 'KITEPROP_EXTERNALSITE' } });
    expect(count).toBe(3);
  });

  it('idempotencia: correr 2 veces no duplica', async () => {
    const before = await prisma.listing.count({ where: { source: 'KITEPROP_EXTERNALSITE' } });
    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });
    const after = await prisma.listing.count({ where: { source: 'KITEPROP_EXTERNALSITE' } });
    expect(after).toBe(before);
  });

  it('updates cambian lastSyncedAt y lastSeenAt', async () => {
    const listing = await prisma.listing.findFirst({
      where: { source: 'KITEPROP_EXTERNALSITE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(listing).toBeTruthy();
    const firstSync = listing!.lastSyncedAt;
    const firstSeen = listing!.lastSeenAt;

    await new Promise((r) => setTimeout(r, 50));
    await runIngest({ source: 'KITEPROP_EXTERNALSITE', limit: 200 });

    const updated = await prisma.listing.findUnique({
      where: { id: listing!.id },
    });
    expect(updated).toBeTruthy();
    expect(updated!.lastSyncedAt.getTime()).toBeGreaterThanOrEqual(firstSync.getTime());
    expect(updated!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(firstSeen.getTime());
  });
});

describe('Ingest Kiteprop difusions (fixture mode)', () => {
  const SOURCES = [
    { source: 'KITEPROP_DIFUSION_ZONAPROP' as const, expected: 3 },
    { source: 'KITEPROP_DIFUSION_TOCTOC' as const, expected: 2 },
    { source: 'KITEPROP_DIFUSION_ICASAS' as const, expected: 3 },
  ];

  beforeAll(async () => {
    await prisma.listing.deleteMany({
      where: {
        source: {
          in: [
            'KITEPROP_DIFUSION_ZONAPROP',
            'KITEPROP_DIFUSION_TOCTOC',
            'KITEPROP_DIFUSION_ICASAS',
          ],
        },
      },
    });
    await prisma.syncWatermark.deleteMany({
      where: {
        source: {
          in: [
            'KITEPROP_DIFUSION_ZONAPROP',
            'KITEPROP_DIFUSION_TOCTOC',
            'KITEPROP_DIFUSION_ICASAS',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: {
        source: {
          in: [
            'KITEPROP_DIFUSION_ZONAPROP',
            'KITEPROP_DIFUSION_TOCTOC',
            'KITEPROP_DIFUSION_ICASAS',
          ],
        },
      },
    });
    await prisma.syncWatermark.deleteMany({
      where: {
        source: {
          in: [
            'KITEPROP_DIFUSION_ZONAPROP',
            'KITEPROP_DIFUSION_TOCTOC',
            'KITEPROP_DIFUSION_ICASAS',
          ],
        },
      },
    });
  });

  for (const { source, expected } of SOURCES) {
    it(`ingest ${source} carga datos desde fixtures`, async () => {
      const result = await runIngest({ source, limit: 200 });
      expect(result.inserted).toBe(expected);
      const count = await prisma.listing.count({ where: { source } });
      expect(count).toBe(expected);
    });
  }
});
