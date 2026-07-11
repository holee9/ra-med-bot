// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/ra/updates/[id] (SPEC-REGULA-RADAR-001).
// @MX:SPEC SPEC-REGULA-RADAR-001
//
// No prior test existed (0% coverage). Invokes GET with db (select + cache update)
// + Vercel AI SDK generateText + logger mocked. Covers: cached path, on-demand
// analyze (generate + cache write), LLM failure fallback, 404, missing-id 400.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

const generateText = vi.fn();
const updateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('ai', () => ({ generateText }));
vi.mock('@/lib/ai/llm-provider', () => ({ getLlmModel: vi.fn(() => ({ id: 'main' })) }));
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }));

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
        return handler(req, ctx, { user: { id: 'user-001', role: 'ra-member', organizationId } });
      },
  ),
}));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      update: () => ({ set: () => ({ where: updateWhere }) }),
    },
  };
});

const { GET } = await import('@/app/api/ra/updates/[id]/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/ra/updates/u-1?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  selectQueue = [];
  generateText.mockResolvedValue({ text: 'LLM impact analysis text' });
});

describe('GET /api/ra/updates/[id] (SPEC-REGULA-RADAR-001)', () => {
  it('returns 200 with the cached impact analysis when present (no LLM call)', async () => {
    selectQueue = [[{ id: 'u-1', title: 'T', impactAnalysisText: 'cached analysis' }]];
    const res = await GET(getReq(''), { params: { id: 'u-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.update.impactAnalysisText).toBe('cached analysis');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('does not regenerate when analyze=true but analysis is already cached', async () => {
    selectQueue = [[{ id: 'u-1', title: 'T', impactAnalysisText: 'cached' }]];
    const res = await GET(getReq('analyze=true'), { params: { id: 'u-1' } });
    expect(res.status).toBe(200);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('generates + caches the analysis on demand when not yet cached', async () => {
    selectQueue = [[{ id: 'u-1', title: 'T', impactAnalysisText: null }]];
    const res = await GET(getReq('analyze=true'), { params: { id: 'u-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalled();
    expect(body.update.impactAnalysisText).toBe('LLM impact analysis text');
    expect(updateWhere).toHaveBeenCalled();
  });

  it('falls back gracefully when the LLM call fails (no crash, null analysis)', async () => {
    generateText.mockRejectedValueOnce(new Error('llm down'));
    selectQueue = [[{ id: 'u-1', title: 'T', impactAnalysisText: null }]];
    const res = await GET(getReq('analyze=true'), { params: { id: 'u-1' } });
    expect(res.status).toBe(200);
    expect((await res.json()).update.impactAnalysisText).toBeNull();
  });

  it('returns 404 when the update does not exist', async () => {
    selectQueue = [[]];
    const res = await GET(getReq(''), { params: { id: 'ux' } });
    expect(res.status).toBe(404);
  });

  it('returns 400 Missing update ID when id is absent', async () => {
    const res = await GET(getReq(''), { params: {} });
    expect(res.status).toBe(400);
  });
});
