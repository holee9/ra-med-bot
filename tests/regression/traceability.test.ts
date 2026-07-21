// @MX:NOTE [AUTO] REQ traceability smoke tests — verifies all major module exports exist.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-061)

import { describe, expect, it, vi } from 'vitest';

// Mock DB client and auth to avoid env validation during module load
vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    })),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  },
  // #239 Phase 2: withTenantScope stub — delegates to an inline transaction
  // so any transitive route import that calls withTenantScope does not crash.
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: unknown) => Promise<T>): Promise<T> => fn({}),
  ),
}));

vi.mock('@/lib/kernel/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-001', role: 'ra-member' } }),
}));

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn((_action: string, handler: unknown) => handler),
}));

describe('REQ traceability', () => {
  it('REQ-ENTERPRISE-007: POLICY_BLOCKED_KEYWORDS exported', async () => {
    const { POLICY_BLOCKED_KEYWORDS } = await import('@/lib/ai/policy-keywords');
    expect(POLICY_BLOCKED_KEYWORDS.length).toBeGreaterThan(0);
  });

  it('REQ-ENTERPRISE-008: shouldAutoFlag exported', async () => {
    const { shouldAutoFlag } = await import('@/lib/ai/expert-review-gating');
    expect(typeof shouldAutoFlag).toBe('function');
  });

  it('REQ-ENTERPRISE-019: withPermission exported', async () => {
    const { withPermission } = await import('@/lib/kernel/auth/with-permission');
    expect(typeof withPermission).toBe('function');
  });

  it('REQ-ENTERPRISE-031: theme store exported', async () => {
    const { useUIStore } = await import('@/stores/ui');
    expect(typeof useUIStore).toBe('function');
  });

  it('REQ-ENTERPRISE-049: captureError exported', async () => {
    const { captureError } = await import('@/lib/observability/sentry');
    expect(typeof captureError).toBe('function');
  });

  it('REQ-ENTERPRISE-051: traceLlmCall exported', async () => {
    const { traceLlmCall } = await import('@/lib/observability/langfuse');
    expect(typeof traceLlmCall).toBe('function');
  });

  // Additional traceability checks
  it('REQ-ENTERPRISE-017: hasRole exported from rbac', async () => {
    const { hasRole } = await import('@/lib/kernel/auth/rbac');
    expect(typeof hasRole).toBe('function');
  });

  it('REQ-ENTERPRISE-020: PERMISSIONS exported from permissions', async () => {
    const { PERMISSIONS } = await import('@/lib/kernel/auth/permissions');
    expect(typeof PERMISSIONS).toBe('object');
  });

  it('REQ-ENTERPRISE-057/058: profile route GET and PATCH exported', async () => {
    const mod = await import('@/app/api/ra/profile/route');
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.PATCH).toBe('function');
  });

  it('REQ-ENTERPRISE-016: writeAudit exported from audit', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    expect(typeof writeAudit).toBe('function');
  });

  it('REQ-ENTERPRISE-031: theme toggle actions exist on useUIStore', async () => {
    const { useUIStore } = await import('@/stores/ui');
    const state = useUIStore.getState();
    expect(typeof state.setTheme).toBe('function');
    expect(typeof state.toggleTheme).toBe('function');
  });
});
