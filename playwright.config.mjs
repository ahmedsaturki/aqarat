import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e/visual',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]] : 'list',
  webServer: {
    command: 'node scripts/visual-server.mjs',
    url: 'http://127.0.0.1:4173/dashboard/',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    browserName: 'firefox',
    colorScheme: 'dark',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
