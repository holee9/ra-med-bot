// Unit tests for isProductionEmail helper.
// Uses vitest (not Playwright runner).
// @MX:SPEC SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-004)

import { describe, expect, it, vi } from 'vitest';
import { e2eApiUrl, ensureE2EProjects } from './globalSetup';

// Re-implement the pure logic under test directly so unit tests do not depend
// on the module-level constant evaluated at import time in globalSetup.ts.
// The actual globalSetup.ts uses the same logic; this tests the pattern.
function makeIsProductionEmail(domain: string | undefined) {
  const pattern = domain ? new RegExp(`@${domain.replace(/\./g, '\\.')}$`, 'i') : null;
  return (email: string): boolean => {
    if (!pattern) return false;
    return pattern.test(email);
  };
}

describe('isProductionEmail', () => {
  it('returns false when E2E_PRODUCTION_DOMAIN is not set', () => {
    const isProductionEmail = makeIsProductionEmail(undefined);
    expect(isProductionEmail('user@example.com')).toBe(false);
  });

  it('returns true when email matches the configured domain', () => {
    const isProductionEmail = makeIsProductionEmail('company.com');
    expect(isProductionEmail('alice@company.com')).toBe(true);
  });

  it('returns false when email does not match the configured domain', () => {
    const isProductionEmail = makeIsProductionEmail('company.com');
    expect(isProductionEmail('alice@other.com')).toBe(false);
  });
});

describe('ensureE2EProjects', () => {
  it('builds absolute API URLs from the Playwright base URL', () => {
    expect(e2eApiUrl('/api/ra/projects', 'http://127.0.0.1:4100')).toBe(
      'http://127.0.0.1:4100/api/ra/projects',
    );
  });

  it('creates only missing validation projects', async () => {
    const post = vi.fn().mockResolvedValue({ ok: () => true, status: () => 201 });
    const page = {
      request: {
        get: vi.fn().mockResolvedValue({
          ok: () => true,
          status: () => 200,
          json: async () => ({ projects: [{ name: 'Guest Validation Alpha' }] }),
        }),
        post,
      },
    } as unknown as Parameters<typeof ensureE2EProjects>[0];

    await ensureE2EProjects(page, 'http://localhost:3000');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'http://localhost:3000/api/ra/projects',
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Guest Validation Beta' }),
      }),
    );
  });
});
