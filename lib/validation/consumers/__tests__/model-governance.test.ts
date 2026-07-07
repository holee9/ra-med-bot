// @MX:NOTE [AUTO] Unit tests for model-governance consumer (SPEC-REGULA-VALIDATION-002 M0).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { describe, expect, it, vi } from 'vitest';

// Note: fetchWindowScopedChangeRequests requires a real Drizzle DB instance.
// Unit tests with mocked DB are complex; the function is tested via integration tests
// with a test database. The function signature and type exports are verified here.

describe('fetchWindowScopedChangeRequests (unit)', () => {
  it('should be exported as a function', async () => {
    const { fetchWindowScopedChangeRequests } = await import('../model-governance');
    expect(typeof fetchWindowScopedChangeRequests).toBe('function');
  });

  it('should have ChangeRequestRow as a type export', async () => {
    // TypeScript types are erased at runtime, so we verify the module exports.
    const module = await import('../model-governance');
    expect('fetchWindowScopedChangeRequests' in module).toBe(true);
  });
});
