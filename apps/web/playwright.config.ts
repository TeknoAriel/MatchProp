import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_BROWSER: firefox | chromium. Default: chromium (Firefox falla en macOS 12).
const defaultBrowser = 'chromium';
const browser = (process.env.PLAYWRIGHT_BROWSER || defaultBrowser) as 'firefox' | 'chromium';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    ...(browser === 'chromium' && {
      launchOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    }),
  },
  projects: [
    browser === 'firefox'
      ? { name: 'firefox', use: { ...devices['Desktop Firefox'] } }
      : { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  timeout: 180000,
});
