import { defineConfig } from '@playwright/test'
export default defineConfig({
  webServer: {
    command: 'yarn serve-app',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  timeout: 120 * 1000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  testDir: 'tests/playwright/',
})
