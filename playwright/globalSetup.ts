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

export function e2eApiUrl(pathname: string, baseUrl?: string): string {
  return new URL(pathname, baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000')
    .href;
}

export async function ensureE2EProjects(
  page: import('@playwright/test').Page,
  baseUrl?: string,
): Promise<void> {
  const desired = ['Guest Validation Alpha', 'Guest Validation Beta'];
  const projectsUrl = e2eApiUrl('/api/ra/projects', baseUrl);
  const res = await page.request.get(projectsUrl);
  if (!res.ok()) {
    throw new Error(`globalSetup failed: project bootstrap GET returned ${res.status()}`);
  }

  const body = (await res.json()) as { projects?: Array<{ name?: string }> };
  const existing = new Set((body.projects ?? []).map((p) => p.name).filter(Boolean));

  for (const name of desired) {
    if (existing.has(name)) continue;
    const createRes = await page.request.post(projectsUrl, {
      data: {
        name,
        deviceClass: 'Class II',
        targetMarkets: ['FDA'],
      },
    });
    if (!createRes.ok()) {
      throw new Error(
        `globalSetup failed: project bootstrap POST '${name}' returned ${createRes.status()}`,
      );
    }
  }
}

export async function signInAndStoreState(options: {
  browser: import('@playwright/test').Browser;
  email: string;
  password: string;
  authStatePath: string;
  baseUrl: string;
  bootstrapProjects?: boolean;
}): Promise<void> {
  const { browser, email, password, authStatePath, baseUrl, bootstrapProjects = false } = options;
  if (isProductionEmail(email)) {
    throw new Error('E2E must use dedicated test account');
  }

  const dir = path.dirname(authStatePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const context = await browser.newContext();
  try {
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

    if (bootstrapProjects) {
      await ensureE2EProjects(page, baseUrl);
    }

    // Serialize cookies + localStorage → .auth.json
    await context.storageState({ path: authStatePath });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!reason.startsWith('globalSetup failed:')) {
      throw new Error(`globalSetup failed: ${reason}`);
    }
    throw err;
  } finally {
    await context.close();
  }
}

export default async function globalSetup(): Promise<void> {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    // No credentials provided — skip auth setup.
    // Tests relying on auth will be skipped via env-guard (requiresAuthState).
    return;
  }

  const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json';
  const adminAuthStatePath =
    process.env.PLAYWRIGHT_ADMIN_AUTH_STATE ?? 'tests/e2e/fixtures/.admin-auth.json';
  const adminEmail = process.env.E2E_ADMIN_USER_EMAIL ?? 'admin@example.test';
  const adminPassword = process.env.E2E_ADMIN_USER_PASSWORD ?? password;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    await signInAndStoreState({
      browser,
      email,
      password,
      authStatePath,
      baseUrl,
      bootstrapProjects: true,
    });

    await signInAndStoreState({
      browser,
      email: adminEmail,
      password: adminPassword,
      authStatePath: adminAuthStatePath,
      baseUrl,
    });
  } finally {
    await browser.close();
  }
}
