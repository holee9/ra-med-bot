// @MX:NOTE [AUTO] Route tests for POST /api/rlhf/feedback (coverage 402, SPEC-REGULA-RLHF-001).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003..005, REQ-RLHF-009, REQ-RLHF-011, AC-01, AC-02)
// @MX:TODO Deep gap/promo bridge + Langfuse emitter + RLHF scoring covered by
//   lib/rlhf/*.test.ts. These tests exercise the route handler surface only:
//   auth passthrough, Zod validation (12-tag enum), C-1 IDOR guard, C-3 tx
//   atomicity (insert + audit in one tx), L-2 revised branch, Issue #264
//   implicit_regenerate path, and error branches.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session ---
let sessionUser: {
  id: string;
  role: string;
  organizationId: string | null;
} = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
};

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: queued select + transaction with update/insert chain ---
const selectResults: unknown[][] = [];

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// Single chain: update().set().where().returning() AND insert().values().returning()
// Both update and insert start from this object. `.where()` and `.values()` both
// return `this`, so `.returning()` is always reachable at the tail.
const mockReturningValue = [{ id: 'fb-001' }];

function makeMutationChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(mockReturningValue);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain(selectResults.shift() ?? [])),
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      update: vi.fn(() => makeMutationChain()),
      insert: vi.fn(() => makeMutationChain()),
      execute: vi.fn(),
    }),
  ),
};

vi.mock('@/lib/db/client', () => ({
  db: mockDb,
  withTenantScope: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) =>
    mockDb.transaction(fn),
  ),
}));

// --- Mock audit ---
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock RLHF access (C-1 IDOR guard) ---
const assertMessageInOrgMock = vi.fn();
vi.mock('@/lib/rlhf/access', () => ({
  assertMessageInOrg: (...a: unknown[]) => assertMessageInOrgMock(...a),
}));

// --- Mock gap/promo bridge (best-effort, MUST NOT throw) ---
const createGapIssueMock = vi.fn().mockResolvedValue(undefined);
const proposePromoMock = vi.fn();
vi.mock('@/lib/rlhf/gap-promo-bridge', () => ({
  createGapIssueForLowRatedAnswer: (...a: unknown[]) => createGapIssueMock(...a),
  proposePromotionCandidateForHighRatedAnswer: (...a: unknown[]) => proposePromoMock(...a),
}));

// --- Mock Langfuse emitter (graceful no-op) ---
vi.mock('@/lib/rlhf/langfuse-emitter', () => ({
  emitFeedbackEvent: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock logger (route calls logger.error/warn on failure paths) ---
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/rlhf/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440000';

const VALID_BODY = {
  messageId: VALID_MESSAGE_ID,
  rating: 'up' as const,
  qualityTags: ['helpful'],
  comment: 'Great answer',
};

describe('POST /api/rlhf/feedback — handler surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    selectResults.length = 0;
    assertMessageInOrgMock.mockResolvedValue(null); // access granted
  });

  it('returns 200 with feedbackId on valid insert (new row)', async () => {
    selectResults.push([]); // existing feedback lookup → empty (new row)

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      feedbackId: 'fb-001',
      messageId: VALID_MESSAGE_ID,
      revised: false,
    });
  });

  it('writes feedback_submitted audit inside transaction (C-3 atomicity)', async () => {
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();
    selectResults.push([]); // new row

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    await POST(makePostRequest(VALID_BODY), {});

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback_submitted',
        actor_id: 'user-001',
        resource_type: 'answer_feedback',
        resource_id: 'fb-001',
      }),
      expect.anything(),
    );
  });

  it('marks revised=true and writes audit with revised:true on update branch (L-2)', async () => {
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();
    selectResults.push([{ id: 'fb-existing-001' }]); // existing row → update

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revised).toBe(true);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback_submitted',
        meta_json: expect.objectContaining({ revised: true }),
      }),
      expect.anything(),
    );
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest('not-json'), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_json');
  });

  it('returns 400 validation_failed when messageId is not a uuid', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, messageId: 'not-a-uuid' }), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('validation_failed');
  });

  it('returns 400 validation_failed when rating is not up or down', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, rating: 'sideways' }), {});

    expect(res.status).toBe(400);
  });

  it('returns 400 validation_failed when qualityTags contains invalid tag (AC-02)', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, qualityTags: ['not_a_real_tag'] }), {});

    expect(res.status).toBe(400);
  });

  it('returns 403 no_org_context when session has no organizationId', async () => {
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: null };

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('no_org_context');
  });

  it('returns 403 message_not_in_org when IDOR guard denies (C-1)', async () => {
    assertMessageInOrgMock.mockResolvedValue(
      Response.json({ error: 'message_not_in_org' }, { status: 403 }),
    );

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('message_not_in_org');
  });

  it('forces rating=down and distinct audit action for implicit_regenerate (Issue #264)', async () => {
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();
    selectResults.push([]); // new row

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        rating: 'up', // client sends up, but implicit forces down
        source: 'implicit_regenerate',
      }),
      {},
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rlhf.implicit_feedback_recorded',
        meta_json: expect.objectContaining({ rating: 'down' }),
      }),
      expect.anything(),
    );
    // Implicit feedback MUST NOT trigger gap/promo bridge (Charter [지양-2]).
    expect(createGapIssueMock).not.toHaveBeenCalled();
    expect(proposePromoMock).not.toHaveBeenCalled();
  });

  it('triggers createGapIssueForLowRatedAnswer on explicit down rating', async () => {
    selectResults.push([]); // new row

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        rating: 'down',
        qualityTags: ['citation_missing'],
      }),
      {},
    );

    expect(res.status).toBe(200);
    expect(createGapIssueMock).toHaveBeenCalledOnce();
    expect(proposePromoMock).not.toHaveBeenCalled();
  });

  it('triggers proposePromotionCandidateForHighRatedAnswer on explicit up rating', async () => {
    selectResults.push([]); // new row

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(200);
    expect(proposePromoMock).toHaveBeenCalledOnce();
    expect(createGapIssueMock).not.toHaveBeenCalled();
  });

  it('returns 500 feedback_transaction_failed when tx throws unknown error (C-3 fail closed)', async () => {
    selectResults.push([]); // new row
    // Override withTenantScope to throw inside the tx body
    const { withTenantScope } = await import('@/lib/db/client');
    vi.mocked(withTenantScope).mockRejectedValueOnce(new Error('db connection lost'));

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest(VALID_BODY), {});

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('feedback_transaction_failed');
  });

  it('does not fail the request when gap/promo bridge throws (best-effort)', async () => {
    selectResults.push([]); // new row
    createGapIssueMock.mockRejectedValueOnce(new Error('github down'));

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(makePostRequest({ ...VALID_BODY, rating: 'down' }), {});

    // Request still succeeds — bridge failure is logged, not surfaced.
    expect(res.status).toBe(200);
  });

  it('accepts variationDimensions for implicit feedback', async () => {
    selectResults.push([]);

    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        source: 'implicit_regenerate',
        variationDimensions: { region: 'US', corpus: ' predicates', model: 'gpt-4' },
      }),
      {},
    );

    expect(res.status).toBe(200);
  });
});
