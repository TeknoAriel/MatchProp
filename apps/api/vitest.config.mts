import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Antes de workers/tests: Prisma se importa al cargar módulos de test; setupFiles corre tarde. */
if (!process.env.DATABASE_URL) {
  loadEnv({ path: resolve(__dirname, '.env') });
  loadEnv({ path: resolve(__dirname, '.env.local') });
}
if (!process.env.DATABASE_URL) {
  loadEnv({ path: resolve(process.cwd(), 'apps/api/.env') });
  loadEnv({ path: resolve(process.cwd(), 'apps/api/.env.local') });
}

export default defineConfig({
  envDir: __dirname,
  test: {
    globals: true,
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
    fileParallelism: false, // Evita race entre tests que comparten DB (ingest deleteMany vs leads runIngest)
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
