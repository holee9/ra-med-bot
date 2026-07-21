// @MX:NOTE [AUTO] Integration tests for POST /api/standards/applicability — SPEC-REGULA-STANDARDS-001.
// AC-03: ≤5s response budget. RBAC: standards.read (viewer+). Dead-code proof:
// the route imports mapApplicableStandards and emits 'standards.mapping.generated' audit.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth so withPermission sees a valid viewer session.
const authMock = vi.fn();
vi.mock('@/lib/kernel/auth', () => ({
  auth: () => authMock(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/kernel/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));

const writeAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/kernel/audit', () => ({ writeAudit: (...a: unknown[]) => writeAuditMock(...a) }));

// Mock DB client — withTenantScope passes a fake tx to the callback.
vi.mock('@/lib/kernel/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
  db: {},
}));

// Mock the mapping engine at module-load time (hoisted) so the route uses it.
const mapApplicableStandardsMock = vi.fn();
vi.mock('@/lib/standards/mapping-engine', () => ({
  mapApplicableStandards: (...a: unknown[]) => mapApplicableStandardsMock(...a),
}));

const VALID_PROFILE = {
  deviceTypeKey: 'electrical_medical_device',
  regulatoryPathway: 'fda_510k',
  hasSoftware: false,
  isElectrical: true,
  isSterile: false,
  usesAnimalTissue: false,
};

describe('POST /api/standards/applicability — RBAC + AC-03', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', role: 'viewer', organizationId: 'org-1' },
    });
    mapApplicableStandardsMock.mockResolvedValue({
      results: [],
      deviceProfileKey: 'electrical_medical_device',
      durationMs: 12,
    });
  });

  it('returns 401 when no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/standards/applicability/route');
    const res = await POST(
      new Request('http://localhost/api/standards/applicability', {
        method: 'POST',
        body: JSON.stringify({ deviceProfile: VALID_PROFILE }),
      }),
      {},
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    const { POST } = await import('@/app/api/standards/applicability/route');
    const res = await POST(
      new Request('http://localhost/api/standards/applicability', {
        method: 'POST',
        body: JSON.stringify({ deviceProfile: { deviceTypeKey: '' } }),
      }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('AC-03: viewer can call (standards.read) and response completes under 5s', async () => {
    const { POST } = await import('@/app/api/standards/applicability/route');
    const start = Date.now();
    const res = await POST(
      new Request('http://localhost/api/standards/applicability', {
        method: 'POST',
        body: JSON.stringify({ deviceProfile: VALID_PROFILE }),
      }),
      {},
    );
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(5000);
    // Dead-code proof: mapping engine actually called.
    expect(mapApplicableStandardsMock).toHaveBeenCalledTimes(1);
    // Dead-code proof: audit row emitted with the standards action.
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock.mock.calls[0][0].action).toBe('standards.mapping.generated');
  });
});
