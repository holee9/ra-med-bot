/**
 * TDD: Type-level tests for ESIG schema additions.
 * These tests verify that TypeScript compile-time types are correct.
 * REQ-ESIG-006: Only ra-lead, qa-lead, admin can sign.
 * REQ-ESIG-007: Audit events use append-only audit log.
 */

import { describe, expect, it } from 'vitest';
import type { AuditAction } from '../../kernel/audit';

describe('ESIG AuditAction types', () => {
  it('signature.applied is a valid AuditAction', () => {
    const action: AuditAction = 'signature.applied';
    expect(action).toBe('signature.applied');
  });

  it('signature.revoked is a valid AuditAction', () => {
    const action: AuditAction = 'signature.revoked';
    expect(action).toBe('signature.revoked');
  });

  it('both signature actions are in an AuditAction array', () => {
    const sigActions: AuditAction[] = ['signature.applied', 'signature.revoked'];
    expect(sigActions).toHaveLength(2);
  });
});
