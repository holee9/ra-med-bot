import * as fs from 'node:fs';
import * as path from 'node:path';
// @MX:NOTE [AUTO] Playwright globalSetup — SSO login → serialize .auth.json.
// @MX:SPEC SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-004, REQ-E2EFIX-007, REQ-E2EFIX-003)
import { chromium } from '@playwright/test';

const PROD_DOMAIN_PATTERN = process.env.E2E_PRODUCTION_DOMAIN
  ? new RegExp(`@${process.env.E2E_PRODUCTION_DOMAIN.replace(/\./g, '\\.')}$`, 'i')
  : null;

export function isProductionEmail(email: string): boolean {
  if (!PROD_DOMAIN_PATTERN) return false;
  return PROD_DOMAIN_PATTERN.test(email);
}

export default async function globalSetup(): Promise<void> {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    // No credentials provided — skip auth setup.
    // Tests relying on auth will be skipped via env-guard (requiresAuthState).
    return;
  }

  if (isProductionEmail(email)) {
    throw new Error('E2E must use dedicated test account');
  }

  const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json';
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  // Ensure the output directory exists.
  const dir = path.dirname(authStatePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseUrl}/login`);

    // Fill SSO credentials form.
    // The app's /login page renders email + password fields that trigger the SSO flow.
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
      throw new Error('globalSetup failed: login page did not render email input within 15s');
    });

    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page.keyboard.press('Enter');

    // Wait for redirect to the app root after successful SSO.
    await page
      .waitForURL(
        (url) => !url.pathname.includes('/login') && !url.pathname.includes('/api/auth'),
        {
          timeout: 30_000,
        },
      )
      .catch(() => {
        throw new Error(
          'globalSetup failed: SSO login did not redirect away from /login within 30s',
        );
      });

    // Serialize cookies + localStorage → .auth.json
    await context.storageState({ path: authStatePath });
    await context.close();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!reason.startsWith('globalSetup failed:')) {
      throw new Error(`globalSetup failed: ${reason}`);
    }
    throw err;
  } finally {
    await browser.close();
  }
}
