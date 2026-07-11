// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/radar/search (SPEC-REGULA-RADAR-001).
// @MX:SPEC SPEC-REGULA-RADAR-001
//
// No prior test existed (0% coverage). Invokes POST with the Vercel AI SDK
// generateText + db mocked. Covers: LLM intent-parse success, LLM throw →
// keyword-only fallback, empty-LLM-text fallback, and 422 validation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let rows: unknown[] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const generateText = vi.fn();
const writeAudit = vi.fn(async (_input: AuditInput) => {});

vi.mock('ai', () => ({ generateText }));

vi.mock('@/lib/ai/llm-provider', () => ({ getLlmFastModel: vi.fn(() => ({ id: 'fast' })) }));

vi.mock('@/lib/audit', () => ({ writeAudit }));

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
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain resolves to rows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  return { db: { select: () => chain } };
});

const { POST } = await import('@/app/api/ra/radar/search/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/radar/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  rows = [];
  generateText.mockResolvedValue({
    text: JSON.stringify({ keywords: ['510(k)', 'cybersecurity'], region: 'US' }),
  });
});

describe('POST /api/ra/radar/search (SPEC-REGULA-RADAR-001)', () => {
  it('returns 200 with LLM-parsed intent + results + radar.search audit', async () => {
    rows = [{ id: 'u1', title: '510(k) cybersecurity guidance' }];
    const res = await POST(postReq({ query: '510(k) cybersecurity guidance' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.intent.keywords).toEqual(['510(k)', 'cybersecurity']);
    expect(body.results).toHaveLength(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
    const audit = writeAudit.mock.calls[0]?.[0];
    expect(audit?.action).toBe('radar.search');
    expect(audit?.meta_json?.intent).toEqual({
      keywords: ['510(k)', 'cybersecurity'],
      region: 'US',
    });
  });

  it('falls back to keyword-only search when generateText throws', async () => {
    generateText.mockRejectedValueOnce(new Error('llm down'));
    rows = [];
    const res = await POST(postReq({ query: 'plain query' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.intent.keywords).toEqual(['plain query']);
  });

  it('falls back to keyword-only search when the LLM text is empty', async () => {
    generateText.mockResolvedValueOnce({ text: '' });
    const res = await POST(postReq({ query: 'solo query' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.intent.keywords).toEqual(['solo query']);
  });

  it('returns 422 on an empty query', async () => {
    const res = await POST(postReq({ query: '' }), {});
    expect(res.status).toBe(422);
  });
});
