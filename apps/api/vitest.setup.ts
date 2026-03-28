/**
 * Setup global para tests. Ejecuta antes de los tests.
 * - VITEST: desactiva under-pressure (evita 503 en tests).
 * - APP_URL: base para magic links (evita Invalid URL si link fuera relativo).
 * - KITEPROP_EXTERNALSITE_MODE: fixture evita fetch a internet en ingest.
 * - DATABASE_URL: CI la inyecta; en local se cargan .env del paquete api (no depender de process.cwd:
 *   desde la raíz del monorepo `pnpm --filter api test:all` dejaba cwd=MatchProp y fallaba Prisma).
 */
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const apiPackageRoot = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  loadEnv({ path: resolve(apiPackageRoot, '.env') });
  if (process.env.DATABASE_URL) return;
  loadEnv({ path: resolve(apiPackageRoot, '.env.local') });
  if (process.env.DATABASE_URL) return;
  loadEnv({ path: resolve(process.cwd(), 'apps/api/.env') });
  if (process.env.DATABASE_URL) return;
  loadEnv({ path: resolve(process.cwd(), 'apps/api/.env.local') });
  if (process.env.DATABASE_URL) return;
  loadEnv({ path: resolve(process.cwd(), '.env') });
}

loadDatabaseUrlFromEnvFiles();

process.env.VITEST = 'true';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';
process.env.KITEPROP_EXTERNALSITE_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_ZONAPROP_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_TOCTOC_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_ICASAS_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_YUMBLIN_MODE = 'fixture';
process.env.INTEGRATIONS_MASTER_KEY =
  process.env.INTEGRATIONS_MASTER_KEY || 'vitest-master-key-32-chars-minimum!!';
