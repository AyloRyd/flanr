import { defineConfig, devices } from '@playwright/test';

const port = 3000;

export default defineConfig({
  testDir: './e2e',
  // A Clerk testing token and a test user in the Clerk development instance.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
