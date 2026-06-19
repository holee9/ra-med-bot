import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// @MX:NOTE: [AUTO] Playwright config entry point for E2E tests
// @MX:SPEC: REQ-LAUNCH-013, REQ-LAUNCH-014, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-005)

const AUTH_STATE_PATH = 'tests/e2e/fixtures/.auth.json';

// Only wire storageState when the file exists or PLAYWRIGHT_AUTH_STATE is explicitly set.
// This prevents Playwright from erroring when .auth.json has not been generated yet.
const resolvedStorageState: string | undefined =
  process.env.PLAYWRIGHT_AUTH_STATE !== undefined
    ? process.env.PLAYWRIGHT_AUTH_STATE
    : fs.existsSync(AUTH_STATE_PATH)
      ? AUTH_STATE_PATH
      : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/fixtures/**/*.test.ts'],
  globalSetup: path.resolve(__dirname, './playwright/globalSetup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  webServer: {
    command: 'PORT=36534 DATABASE_URL=postgresql://postgres:test@localhost:5432/regula_test pnpm env:test pnpm dev:public',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:36534',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    storageState: resolvedStorageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
    // Firefox and WebKit run in CI only — not installed on Ubuntu 26.04 snap-only environments
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
});
