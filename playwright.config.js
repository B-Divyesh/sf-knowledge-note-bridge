import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './site/tests',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: /claims\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', testIgnore: /claims\.spec\.js/, use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'claims', testMatch: /claims\.spec\.js/, use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node scripts/serve-site.mjs',
    port: 4173,
    reuseExistingServer: true
  }
});
