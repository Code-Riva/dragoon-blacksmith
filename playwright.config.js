// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use */
  reporter: 'list',
  /* Shared settings for all the projects below */
  use: {
    baseURL: 'http://127.0.0.1:3456',
    trace: 'off',
  },

  /* Configure projects for installed browser (Chromium) */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run Next.js production server before starting the tests */
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next start -p 3456',
    url: 'http://127.0.0.1:3456',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
