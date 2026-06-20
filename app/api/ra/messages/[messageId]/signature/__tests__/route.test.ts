/**
 * TDD RED: Tests for POST/GET /api/ra/messages/[messageId]/signature
 * REQ-ESIG-001: Signature captures identity, timestamp, meaning.
 * REQ-ESIG-002: SHA-256 hash links signature to answer record.
 * REQ-ESIG-004: §11.50 manifestation via GET endpoint.
 * REQ-ESIG-006: RBAC — only ra-lead, qa-lead, admin can sign.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies before importing route
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));
// db mock with chainable select for the 201 success path
const mockSelect = vi.fn();
vi.mock('@/lib/db/client', () => ({
  get db() {
    return { select: mockSelect };
  },
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
  insertSignature: vi.fn(),
  revokeSignature: vi.fn(),
}));
vi.mock('@/lib/signature/authorization', () => ({
  getAuthorizedSignatureMessage: vi.fn(),
}));
vi.mock('@/lib/signature/lock', () => ({
  isAnswerLocked: vi.fn(),
}));
vi.mock('@/lib/signature/hash', () => ({
  computeAnswerHash: vi
    .fn()
    .mockResolvedValue('deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'),
}));

import { auth } from '@/lib/auth';
import { getAuthorizedSignatureMessage } from '@/lib/signature/authorization';
import { getActiveSignature, insertSignature } from '@/lib/signature/queries';
import { GET, POST } from '../route';

const mockRaLeadSession = {
  user: {
    id: 'user-lead-001',
    role: 'ra-lead',
    organizationId: 'org-001',
    email: 'lead@example.com',
    name: 'Alice Lead',
  },
};

const mockMemberSession = {
  user: {
    id: 'user-member-001',
    role: 'ra-member',
    organizationId: 'org-001',
    email: 'member@example.com',
    name: 'Bob Member',
  },
};

const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/ra/messages/msg-001/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeGetRequest = () =>
  new Request('http://localhost/api/ra/messages/msg-001/signature', {
    method: 'GET',
  });

const makeCtx = (messageId = 'msg-001') => ({
  params: Promise.resolve({ messageId }),
});

describe('POST /api/ra/messages/[messageId]/signature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue({
      id: 'msg-001',
      contentProse: 'Test answer content',
    });
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const req = makeRequest({ meaning: 'Approved' });
    const res = await POST(req, makeCtx());

    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks signature.sign permission (ra-member)', async () => {
    vi.mocked(auth).mockResolvedValue(mockMemberSession as never);

    const req = makeRequest({ meaning: 'Approved' });
    const res = await POST(req, makeCtx());

    expect(res.status).toBe(403);
  });

  it('returns 400 when meaning is missing', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue(null);

    const req = makeRequest({});
    const res = await POST(req, makeCtx());

    expect(res.status).toBe(400);
  });

  it('returns 409 when answer is already signed', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue({
      id: 'sig-existing',
      messageId: 'msg-001',
      signerId: 'user-lead-001',
      signerName: 'Alice',
      signerTitle: null,
      meaning: 'Already signed',
      recordHash: 'abc',
      signedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
    });

    const req = makeRequest({ meaning: 'Approved' });
    const res = await POST(req, makeCtx());

    expect(res.status).toBe(409);
  });

  it('returns 404 before signing when message is outside caller scope', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue(null);

    const req = makeRequest({ meaning: 'Approved' });
    const res = await POST(req, makeCtx('foreign-msg'));

    expect(res.status).toBe(404);
    expect(getActiveSignature).not.toHaveBeenCalled();
    expect(insertSignature).not.toHaveBeenCalled();
  });

  it('returns 201 with signature data on success', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue(null);

    // Setup db.select chain for ordered blocks query.
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    vi.mocked(insertSignature).mockResolvedValue({
      id: 'sig-new-001',
      messageId: 'msg-001',
      signerId: 'user-lead-001',
      signerName: 'Alice Lead',
      signerTitle: 'RA Lead',
      meaning: 'Approved for regulatory submission',
      recordHash: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
      signedAt: new Date('2026-06-20T10:00:00Z'),
      revokedAt: null,
      revokedBy: null,
    });

    const req = makeRequest({ meaning: 'Approved for regulatory submission' });
    const res = await POST(req, makeCtx());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('sig-new-001');
    expect(body.recordHash).toBeTruthy();
    expect(body.signedAt).toBeTruthy();
  });
});

describe('GET /api/ra/messages/[messageId]/signature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue({
      id: 'msg-001',
      contentProse: 'Test answer content',
    });
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const req = makeGetRequest();
    const res = await GET(req, makeCtx());

    expect(res.status).toBe(401);
  });

  it('returns 404 when no signature exists', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue(null);

    const req = makeGetRequest();
    const res = await GET(req, makeCtx());

    expect(res.status).toBe(404);
  });

  it('returns 404 before manifestation lookup when message is outside caller scope', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getAuthorizedSignatureMessage).mockResolvedValue(null);

    const req = makeGetRequest();
    const res = await GET(req, makeCtx('foreign-msg'));

    expect(res.status).toBe(404);
    expect(getActiveSignature).not.toHaveBeenCalled();
  });

  it('returns 200 with §11.50 manifestation fields on success', async () => {
    vi.mocked(auth).mockResolvedValue(mockRaLeadSession as never);
    vi.mocked(getActiveSignature).mockResolvedValue({
      id: 'sig-001',
      messageId: 'msg-001',
      signerId: 'user-lead-001',
      signerName: 'Alice Lead',
      signerTitle: 'RA Lead',
      meaning: 'Approved',
      recordHash: 'abc123',
      signedAt: new Date('2026-06-20T10:00:00Z'),
      revokedAt: null,
      revokedBy: null,
    });

    const req = makeGetRequest();
    const res = await GET(req, makeCtx());

    expect(res.status).toBe(200);
    const body = await res.json();
    // §11.50 manifestation fields
    expect(body.signerName).toBe('Alice Lead');
    expect(body.signerTitle).toBe('RA Lead');
    expect(body.meaning).toBe('Approved');
    expect(body.signedAt).toBeTruthy();
    expect(body.recordHash).toBe('abc123');
    expect(body.isRevoked).toBe(false);
  });
});
