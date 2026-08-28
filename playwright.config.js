import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './site/tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true
  }
});
