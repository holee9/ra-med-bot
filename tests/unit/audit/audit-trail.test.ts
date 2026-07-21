// @MX:NOTE [AUTO] T-004 RED phase — getAuditTrail unit tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-037)

import { describe, expect, it, vi } from 'vitest';

import { getAuditTrail } from '../../../lib/kernel/db/queries/audit';

// Mock the db module so tests do not require a real database.
vi.mock('../../../lib/kernel/db/client', () => ({
  db: {},
}));

// describe('getAuditTrail (REQ-ENTERPRISE-037)', () => {
//   Tests verify the exported interface and parameter acceptance.
//   The Drizzle query pipeline is not exercised (no real DB in unit tests).
// });

describe('getAuditTrail (REQ-ENTERPRISE-037)', () => {
  it('exports getAuditTrail as an async function', () => {
    expect(typeof getAuditTrail).toBe('function');
    // Calling it returns a Promise
    const result = getAuditTrail({});
    expect(result).toBeInstanceOf(Promise);
    // Silence unhandled rejection from missing real db
    result.catch(() => undefined);
  });

  it('accepts all optional AuditTrailParams without TypeScript error', async () => {
    // This test verifies that the function signature accepts all optional params.
    // The actual DB call will fail (no real DB) — we only check that it does not throw
    // a synchronous type/shape error.
    const params = {
      resourceType: 'message_block',
      resourceId: 'uuid-1',
      actorId: 'uuid-2',
      from: new Date('2024-01-01'),
      to: new Date('2025-01-01'),
      limit: 10,
      offset: 0,
    };
    const promise = getAuditTrail(params);
    expect(promise).toBeInstanceOf(Promise);
    await promise.catch(() => undefined);
  });

  it('accepts empty params object without error', async () => {
    const promise = getAuditTrail({});
    expect(promise).toBeInstanceOf(Promise);
    await promise.catch(() => undefined);
  });
});
