/**
 * Setup global para tests. Ejecuta antes de los tests.
 * - VITEST: desactiva under-pressure (evita 503 en tests).
 * - APP_URL: base para magic links (evita Invalid URL si link fuera relativo).
 * - KITEPROP_EXTERNALSITE_MODE: fixture evita fetch a internet en ingest.
 */
process.env.VITEST = 'true';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';
process.env.KITEPROP_EXTERNALSITE_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_ZONAPROP_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_TOCTOC_MODE = 'fixture';
process.env.KITEPROP_DIFUSION_ICASAS_MODE = 'fixture';
process.env.INTEGRATIONS_MASTER_KEY =
  process.env.INTEGRATIONS_MASTER_KEY || 'vitest-master-key-32-chars-minimum!!';
