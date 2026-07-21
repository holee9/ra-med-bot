// @MX:NOTE [AUTO] Route tests for POST|GET /api/ra/messages/[messageId]/signature (coverage 402).
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-001, REQ-ESIG-002, REQ-ESIG-004)
// @MX:TODO Deep hash/manifestation logic covered by lib/signature/*.test.ts.
//   These tests exercise the route handler surface: auth passthrough, Zod
//   validation, 404/409 conflict branches, audit-in-transaction, GET manifestation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: {
  id: string;
  role: string;
  organizationId: string | null;
  email?: string;
  name?: string;
} = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
  email: 'lead@regula.test',
  name: 'RA Lead',
};

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: select chain for messageBlocks + transaction for signature INSERT ---
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn(),
};

const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockDb = {
  select: vi.fn(() => mockSelectChain),
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ insert: vi.fn(() => mockInsertChain) }),
  ),
};

vi.mock('@/lib/kernel/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock signature authorization (mutable: tests flip to null for 404) ---
const getAuthorizedSignatureMessageMock = vi.fn();
vi.mock('@/lib/signature/authorization', () => ({
  getAuthorizedSignatureMessage: (...a: unknown[]) => getAuthorizedSignatureMessageMock(...a),
}));

// --- Mock getActiveSignature (mutable: tests flip for 409) + insertSignature ---
const getActiveSignatureMock = vi.fn();
const insertSignatureMock = vi.fn();
vi.mock('@/lib/signature/queries', () => ({
  getActiveSignature: (...a: unknown[]) => getActiveSignatureMock(...a),
  insertSignature: (...a: unknown[]) => insertSignatureMock(...a),
}));

// --- Mock computeAnswerHash (pure-ish, but mocked for determinism) ---
const computeAnswerHashMock = vi.fn();
vi.mock('@/lib/signature/hash', () => ({
  computeAnswerHash: (...a: unknown[]) => computeAnswerHashMock(...a),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/messages/msg-001/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeGetRequest(): Request {
  return new Request('http://localhost/api/ra/messages/msg-001/signature', {
    method: 'GET',
  });
}

const VALID_BODY = {
  meaning: 'I approve this answer for regulatory submission.',
  signerTitle: 'RA Lead',
};

const MESSAGE_FIXTURE = {
  id: 'msg-001',
  contentProse: 'The device is classified as Class II.',
  conversationId: 'conv-001',
};

const SIGNATURE_FIXTURE = {
  id: 'sig-001',
  messageId: 'msg-001',
  signerId: 'user-001',
  signerName: 'RA Lead',
  signerTitle: 'RA Lead',
  meaning: 'I approve this answer for regulatory submission.',
  recordHash: 'abc123hash',
  signedAt: '2026-07-11T00:00:00.000Z',
  revokedAt: null,
};

describe('POST /api/ra/messages/[messageId]/signature — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = {
      id: 'user-001',
      role: 'ra-lead',
      organizationId: 'org-001',
      email: 'lead@regula.test',
      name: 'RA Lead',
    };
    getAuthorizedSignatureMessageMock.mockResolvedValue(MESSAGE_FIXTURE);
    getActiveSignatureMock.mockResolvedValue(null);
    computeAnswerHashMock.mockResolvedValue('abc123hash');
    mockSelectChain.orderBy.mockResolvedValue([
      {
        id: 'blk-001',
        blockType: 'prose',
        blockJson: { text: 'The device is classified as Class II.' },
        orderIndex: 0,
      },
    ]);
    insertSignatureMock.mockResolvedValue(SIGNATURE_FIXTURE);
  });

  it('returns 201 with signature record on valid input', async () => {
    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await POST(makePostRequest(VALID_BODY), { params: { messageId: 'msg-001' } });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'sig-001',
      messageId: 'msg-001',
      signerName: 'RA Lead',
    });
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('writes signature.applied audit inside transaction (21 CFR Part 11)', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');
    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    await POST(makePostRequest(VALID_BODY), { params: { messageId: 'msg-001' } });

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'signature.applied',
        actor_id: 'user-001',
        resource_type: 'signature',
        resource_id: 'sig-001',
        meta_json: expect.objectContaining({
          messageId: 'msg-001',
          hash: 'abc123hash',
          meaning: 'I approve this answer for regulatory submission.',
        }),
      }),
      expect.anything(),
    );
  });

  it('computes recordHash from ordered message blocks', async () => {
    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    await POST(makePostRequest(VALID_BODY), { params: { messageId: 'msg-001' } });

    expect(computeAnswerHashMock).toHaveBeenCalled();
    const callArgs = computeAnswerHashMock.mock.calls[0];
    // First arg = message contentProse; second = hashable blocks array.
    expect(callArgs?.[0]).toBe('The device is classified as Class II.');
    expect(Array.isArray(callArgs?.[1])).toBe(true);
  });

  it('returns 404 when message is not found / not authorized', async () => {
    getAuthorizedSignatureMessageMock.mockResolvedValue(null);

    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await POST(makePostRequest(VALID_BODY), { params: { messageId: 'unknown' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Message not found');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when active signature already exists', async () => {
    getActiveSignatureMock.mockResolvedValue({ id: 'existing-sig-001' });

    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await POST(makePostRequest(VALID_BODY), { params: { messageId: 'msg-001' } });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'answer_already_signed',
      signatureId: 'existing-sig-001',
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await POST(makePostRequest('not-json'), {
      params: { messageId: 'msg-001' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when meaning is empty (Zod min(1))', async () => {
    const { POST } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await POST(makePostRequest({ meaning: '' }), {
      params: { messageId: 'msg-001' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });
});

describe('GET /api/ra/messages/[messageId]/signature — manifestation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthorizedSignatureMessageMock.mockResolvedValue(MESSAGE_FIXTURE);
    getActiveSignatureMock.mockResolvedValue(SIGNATURE_FIXTURE);
  });

  it('returns 200 with §11.50 signature manifestation fields', async () => {
    const { GET } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await GET(makeGetRequest(), { params: { messageId: 'msg-001' } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'sig-001',
      signerName: 'RA Lead',
      signerTitle: 'RA Lead',
      meaning: 'I approve this answer for regulatory submission.',
      recordHash: 'abc123hash',
      isRevoked: false,
      revokedAt: null,
    });
  });

  it('returns 404 when message not found', async () => {
    getAuthorizedSignatureMessageMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await GET(makeGetRequest(), { params: { messageId: 'unknown' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Message not found');
  });

  it('returns 404 when no active signature exists', async () => {
    getActiveSignatureMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await GET(makeGetRequest(), { params: { messageId: 'msg-001' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('No signature found');
  });

  it('reports isRevoked=true when signature.revokedAt is set', async () => {
    getActiveSignatureMock.mockResolvedValue({
      ...SIGNATURE_FIXTURE,
      revokedAt: '2026-07-10T00:00:00.000Z',
    });

    const { GET } = await import('@/app/api/ra/messages/[messageId]/signature/route');
    const res = await GET(makeGetRequest(), { params: { messageId: 'msg-001' } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isRevoked).toBe(true);
    expect(body.revokedAt).toBe('2026-07-10T00:00:00.000Z');
  });
});
