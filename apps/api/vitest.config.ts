import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false, // Evita race entre tests que comparten DB (ingest deleteMany vs leads runIngest)
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
