// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/knowledge-gap/replay/[queueId] (SPEC-REGULA-KNOWLEDGE-GAP-001).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-014/015, AC-06/08, Issue #35)
//
// No prior test existed (0% coverage). The route delegates to lib/knowledge-gap/replay
// (replayGapTest + markGapResolved); those are mocked. Covers: passed → markGapResolved,
// not-passed (no resolve), not_found (404) vs replay_failed (500) error split,
// missing_queue_id 400, no_org_context 403.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

const replayGapTest = vi.fn();
const markGapResolved = vi.fn(async () => {});

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated) {
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        }
        return handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/knowledge-gap/replay', () => ({ replayGapTest, markGapResolved }));

const { POST } = await import('@/app/api/knowledge-gap/replay/[queueId]/route');

function postReq(): Request {
  return new Request('http://localhost/api/knowledge-gap/replay/q-1', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  replayGapTest.mockResolvedValue({
    passed: true,
    remainingReason: null,
    reasonSummary: 'gap cleared',
    sources: [{ id: 's1' }, { id: 's2' }],
    answerWithCitations: '<p>answer</p>',
  });
  markGapResolved.mockResolvedValue(undefined);
});

describe('POST /api/knowledge-gap/replay/[queueId] (REQ-KNOWLEDGE-GAP-014/015)', () => {
  it('returns 200 + calls markGapResolved when the replay passes', async () => {
    const res = await POST(postReq(), { params: { queueId: 'q-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ queueId: 'q-1', passed: true, sourceCount: 2 });
    expect(markGapResolved).toHaveBeenCalledWith(
      'q-1',
      expect.objectContaining({ answerWithCitations: '<p>answer</p>' }),
      'org-001',
    );
  });

  it('returns 200 and does NOT resolve when the replay does not pass', async () => {
    replayGapTest.mockResolvedValueOnce({
      passed: false,
      remainingReason: 'low_citation',
      reasonSummary: 'still undercited',
      sources: [],
      answerWithCitations: null,
    });
    const res = await POST(postReq(), { params: { queueId: 'q-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.passed).toBe(false);
    expect(body.remainingReason).toBe('low_citation');
    expect(markGapResolved).not.toHaveBeenCalled();
  });

  it('returns 404 not_found when replayGapTest throws a "not found" error', async () => {
    replayGapTest.mockRejectedValueOnce(new Error('queue row not found'));
    const res = await POST(postReq(), { params: { queueId: 'q-x' } });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 500 replay_failed when replayGapTest throws a generic error', async () => {
    replayGapTest.mockRejectedValueOnce(new Error('llm timeout'));
    const res = await POST(postReq(), { params: { queueId: 'q-1' } });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('replay_failed');
  });

  it('returns 400 missing_queue_id when queueId is absent', async () => {
    const res = await POST(postReq(), { params: {} });
    expect(res.status).toBe(400);
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(), { params: { queueId: 'q-1' } });
    expect(res.status).toBe(403);
  });
});
