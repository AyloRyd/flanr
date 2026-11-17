import { defineConfig, devices } from '@playwright/test';
import { e2eDatabaseUrl } from './e2e/database';

// Ports of their own, so that the tests never use the development servers and their data.
const webPort = 3100;
const apiPort = 8788;

export default defineConfig({
  testDir: './e2e',
  // Seeds the database of the test API, gets a Clerk testing token and creates a test user in
  // the Clerk development instance; the teardown deletes the user.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @flanr/api start',
      // Not /health: the database is created by the global setup, which runs after the servers.
      port: apiPort,
      // The tests write much faster than a person, so the write limit of the API is raised.
      env: { DATABASE_URL: e2eDatabaseUrl, API_PORT: String(apiPort), WRITE_RATE_LIMIT: '10000' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: process.env.CI
        ? `pnpm build && pnpm exec next start --port ${webPort}`
        : `pnpm exec next dev --port ${webPort}`,
      port: webPort,
      env: { API_URL: `http://localhost:${apiPort}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
