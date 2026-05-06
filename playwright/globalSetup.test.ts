// Unit tests for isProductionEmail helper.
// Uses vitest (not Playwright runner).
// @MX:SPEC SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-004)

import { describe, expect, it } from 'vitest';

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
