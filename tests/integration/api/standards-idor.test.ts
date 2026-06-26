// @MX:NOTE [AUTO] IDOR integration test for standards check — cross-org access fails.
// SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-021 citation, Charter [지양-2]).
// Defense-in-depth: even though withTenantScope scopes by orgId, the route
// derives orgId from session.user.organizationId — a viewer from org-A cannot
// see org-B's catalog rows because the query is scoped to org-A.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_orgId: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
  db: {},
}));

const checkRecognitionMock = vi.fn();
vi.mock('@/lib/standards/recognition-check', () => ({
  checkRecognition: (...a: unknown[]) => checkRecognitionMock(...a),
}));

const VALID_UUID = '22222222-2222-2222-2222-222222222222';

describe('standards IDOR — cross-org access is scoped to session org', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('viewer from org-A asking for org-B standard: checkRecognition is called with org-A', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-A', role: 'viewer', organizationId: 'org-A' },
    });
    checkRecognitionMock.mockResolvedValueOnce({
      standardId: VALID_UUID,
      status: 'unknown',
      degraded: true,
      note: 'Org-A scoped — org-B catalog row not visible.',
    });

    const { GET } = await import('@/app/api/standards/check/route');
    await GET(new Request(`http://localhost/api/standards/check?standard=${VALID_UUID}`), {});

    // Defense-in-depth proof: the route threads session.user.organizationId
    // (org-A) into checkRecognition. An org-B attacker cannot widen scope.
    expect(checkRecognitionMock).toHaveBeenCalledTimes(1);
    const callArgs = checkRecognitionMock.mock.calls[0];
    if (!callArgs) throw new Error('checkRecognition was not called');
    expect(callArgs[0]).toBe(VALID_UUID); // standardId
    expect(callArgs[1]).toBe('org-A'); // orgId — NEVER org-B
  });

  it('returns 403 when session has no organizationId', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-orphan', role: 'viewer', organizationId: undefined },
    });
    const { GET } = await import('@/app/api/standards/check/route');
    const res = await GET(
      new Request(`http://localhost/api/standards/check?standard=${VALID_UUID}`),
      {},
    );
    expect(res.status).toBe(403);
  });
});
