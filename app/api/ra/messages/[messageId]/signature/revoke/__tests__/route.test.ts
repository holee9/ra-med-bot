/**
 * TDD RED: Tests for POST /api/ra/messages/[messageId]/signature/revoke
 * REQ-ESIG-005: Revocation requires re-confirmation + new signature + audit entry.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: {},
}));
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: vi.fn().mockResolvedValue(true),
  isProjectMember: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/signature/queries', () => ({
  getActiveSignature: vi.fn(),
  revokeSignature: vi.fn(),
}));
vi.mock('@/lib/signature/authorization', () => ({
  getAuthorizedSignatureMessage: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { getAuthorizedSignatureMessage } from '@/lib/signature/authorization';
import { getActiveSignature, revokeSignature } from '@/lib/signature/queries';
import { POST } from '../route';

const mockRaLeadSession = {
  user: {
    id: 'user-lead-001',
    role: 'ra-lead',
    organizationId: 'org-001',
    email: 'lead@example.com',
    name: 'Alice Lead',
  },
};

const makeRequest = (body: unknown = {}) =>
  new Request('http://localhost/api/ra/messages/msg-001/signature/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeCtx = (messageId = 'msg-001') => ({
  params: Promise.resolve({ messageId }),
});

describe('POST /api/ra/messages/[messageId]/signature/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue({
      id: 'msg-001',
      contentProse: 'Test answer content',
    });
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await POST(makeRequest(), makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks signature.sign permission (ra-member)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u', role: 'ra-member', organizationId: 'org-001', email: 'x@x.com' },
    } as never);

    const res = await POST(makeRequest(), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 404 when no active signature exists', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue(null);

    const res = await POST(makeRequest(), makeCtx());
    expect(res.status).toBe(404);
  });

  it('returns 404 before revocation lookup when message is outside caller scope', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue(null);

    const res = await POST(makeRequest(), makeCtx('foreign-msg'));

    expect(res.status).toBe(404);
    expect(getActiveSignature).not.toHaveBeenCalled();
    expect(revokeSignature).not.toHaveBeenCalled();
  });

  it('returns 200 with revoked signature on success', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue({
      id: 'sig-001',
      messageId: 'msg-001',
      signerId: 'user-lead-001',
      signerName: 'Alice',
      signerTitle: null,
      meaning: 'Approved',
      recordHash: 'abc',
      signedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
    });
    vi.mocked(revokeSignature).mockResolvedValue({
      id: 'sig-001',
      messageId: 'msg-001',
      signerId: 'user-lead-001',
      signerName: 'Alice',
      signerTitle: null,
      meaning: 'Approved',
      recordHash: 'abc',
      signedAt: new Date(),
      revokedAt: new Date(),
      revokedBy: 'user-lead-001',
    });

    const res = await POST(makeRequest(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revokedBy).toBe('user-lead-001');
    expect(body.revokedAt).toBeTruthy();
  });
});
