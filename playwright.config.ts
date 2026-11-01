import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5175',
    headless: true,
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
