// @MX:NOTE [AUTO] T-004 RED phase — auth callback audit wiring tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-029)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// These helper functions will be extracted to lib/kernel/auth/audit-callbacks.ts in GREEN phase.
// Importing will fail RED until that file exists.
import {
  buildLoginAuditEvent,
  buildLogoutAuditEvent,
} from '../../../lib/kernel/auth/audit-callbacks';

describe('buildLoginAuditEvent (REQ-ENTERPRISE-029)', () => {
  it('builds a valid AuditEvent for auth.login with user id and provider', () => {
    const event = buildLoginAuditEvent('user-uuid-123', 'google');
    expect(event.action).toBe('auth.login');
    expect(event.actor_id).toBe('user-uuid-123');
    expect(event.resource_type).toBe('session');
    expect(event.resource_id).toBe('user-uuid-123');
    expect(event.meta_json).toEqual({ provider: 'google' });
  });

  it('handles null user id gracefully', () => {
    const event = buildLoginAuditEvent(null, 'microsoft-entra-id');
    expect(event.action).toBe('auth.login');
    expect(event.actor_id).toBeNull();
    expect(event.resource_id).toBe('');
    expect(event.meta_json).toEqual({ provider: 'microsoft-entra-id' });
  });

  it('handles undefined provider gracefully', () => {
    const event = buildLoginAuditEvent('user-123', undefined);
    expect(event.action).toBe('auth.login');
    expect(event.meta_json).toEqual({ provider: undefined });
  });
});

describe('buildLogoutAuditEvent (REQ-ENTERPRISE-029)', () => {
  it('builds a valid AuditEvent for auth.logout with session token', () => {
    const event = buildLogoutAuditEvent('user-uuid-456', 'sess-token-abc');
    expect(event.action).toBe('auth.logout');
    expect(event.actor_id).toBe('user-uuid-456');
    expect(event.resource_type).toBe('session');
    expect(event.resource_id).toBe('sess-token-abc');
    expect(event.meta_json).toEqual({});
  });

  it('handles null userId gracefully', () => {
    const event = buildLogoutAuditEvent(null, 'sess-token-xyz');
    expect(event.action).toBe('auth.logout');
    expect(event.actor_id).toBeNull();
    expect(event.resource_id).toBe('sess-token-xyz');
  });

  it('handles empty sessionToken gracefully', () => {
    const event = buildLogoutAuditEvent('user-123', '');
    expect(event.action).toBe('auth.logout');
    expect(event.resource_id).toBe('');
  });
});
