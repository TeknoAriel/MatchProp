#!/usr/bin/env node
/**
 * Ejecutar: pnpm --filter api ingest:bundle
 * Ejecuta ingest de ZONAPROP + TOCTOC + ICASAS.
 * Con MODE=fixture usa datos locales (sin red). Sin MODE intenta live y fallback a fixture si falla.
 */
import 'dotenv/config';
import { runIngest } from '../services/ingest/index.js';

const SOURCES = [
  'KITEPROP_DIFUSION_ZONAPROP',
  'KITEPROP_DIFUSION_TOCTOC',
  'KITEPROP_DIFUSION_ICASAS',
] as const;

const MODE_ENV: Record<(typeof SOURCES)[number], string> = {
  KITEPROP_DIFUSION_ZONAPROP: 'KITEPROP_DIFUSION_ZONAPROP_MODE',
  KITEPROP_DIFUSION_TOCTOC: 'KITEPROP_DIFUSION_TOCTOC_MODE',
  KITEPROP_DIFUSION_ICASAS: 'KITEPROP_DIFUSION_ICASAS_MODE',
};

async function runOne(
  source: (typeof SOURCES)[number],
  useFixture: boolean
): Promise<{ inserted: number; error?: string }> {
  if (useFixture) {
    process.env[MODE_ENV[source]] = 'fixture';
  }
  try {
    const result = await runIngest({
      source: source as
        | 'KITEPROP_DIFUSION_ZONAPROP'
        | 'KITEPROP_DIFUSION_TOCTOC'
        | 'KITEPROP_DIFUSION_ICASAS',
      limit: 500,
    });
    return { inserted: result.inserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!useFixture) {
      process.env[MODE_ENV[source]] = 'fixture';
      const fallback = await runIngest({
        source: source as
          | 'KITEPROP_DIFUSION_ZONAPROP'
          | 'KITEPROP_DIFUSION_TOCTOC'
          | 'KITEPROP_DIFUSION_ICASAS',
        limit: 500,
      });
      console.warn(`  ${source} live falló (${msg}), usado fixture: ${fallback.inserted} listings`);
      return { inserted: fallback.inserted };
    }
    return { inserted: 0, error: msg };
  }
}

async function main() {
  const forceFixture = process.env.DEMO_MODE === '1' || process.argv.includes('--fixture');
  console.log(`Ingest bundle (${forceFixture ? 'fixture' : 'live con fallback a fixture'})...`);

  let total = 0;
  for (const source of SOURCES) {
    const { inserted, error } = await runOne(source, forceFixture);
    total += inserted;
    if (error) console.error(`  ${source} error: ${error}`);
    else console.log(`  ${source}: ${inserted} listings`);
  }
  console.log(`Total bundle: ${total} listings`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
