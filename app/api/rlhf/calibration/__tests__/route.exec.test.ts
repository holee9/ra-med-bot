// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET /api/rlhf/calibration (SPEC-REGULA-RLHF-001).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005/006/014/015, Issue #264)
//
// No prior test existed (0% coverage). Invokes GET with withTenantScope + the
// detector lib mocked. The db join chain is modelled as a chainable thenable over
// a per-test row queue. Covers: org scoping, confidence_score string→number
// parsing (null/NaN pass-through), query threshold Number.isFinite branch, and
// the aggregate/candidate wiring.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';
let joinRows: unknown[] = [];

const aggregateConfidenceFeedback = vi.fn((_samples: unknown) => ({ buckets: [] }));
const detectCalibrationCandidates = vi.fn((_samples: unknown, _options: unknown) => ({
  candidates: [],
}));

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

// withTenantScope invokes the callback with a dbs handle whose select() chain is
// a chainable thenable that resolves to joinRows.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain resolves to joinRows.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(joinRows);
  const dbs = { select: () => chain };
  return {
    withTenantScope: vi.fn(async (_orgId: string, fn: (dbs: unknown) => unknown) => fn(dbs)),
  };
});

vi.mock('@/lib/rlhf/calibration-detector', () => ({
  aggregateConfidenceFeedback,
  detectCalibrationCandidates,
}));

const { GET } = await import('@/app/api/rlhf/calibration/route');

function getReq(query: string): Request {
  return new Request(`http://localhost/api/rlhf/calibration?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  joinRows = [];
  aggregateConfidenceFeedback.mockReturnValue({ buckets: [] });
  detectCalibrationCandidates.mockReturnValue({ candidates: [] });
});

describe('GET /api/rlhf/calibration (REQ-RLHF-005/006)', () => {
  it('returns 200 with aggregates + candidates + thresholds, org-scoped', async () => {
    joinRows = [
      { confidenceScore: '0.8', rating: 'positive' },
      { confidenceScore: '0.4', rating: 'negative' },
    ];
    const res = await GET(getReq(''), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.orgId).toBe('org-001');
    expect(body.aggregates).toEqual({ buckets: [] });
    expect(body.candidates).toEqual({ candidates: [] });
    expect(body.thresholds).toEqual({ minSampleSize: 5, maxTolerance: 0.15 });
    // Samples parsed from Drizzle numeric strings → numbers.
    const samples = aggregateConfidenceFeedback.mock.calls[0]?.[0] as Array<{
      confidence: number | null;
      rating: string;
    }>;
    expect(samples[0]).toEqual({ confidence: 0.8, rating: 'positive' });
  });

  it('passes null confidence through (mapping branch)', async () => {
    joinRows = [{ confidenceScore: null, rating: 'positive' }];
    await GET(getReq(''), {});
    const samples = aggregateConfidenceFeedback.mock.calls[0]?.[0] as Array<{
      confidence: number | null;
    }>;
    expect(samples[0]?.confidence).toBeNull();
  });

  it('returns 403 no_org_context when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(getReq(''), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('no_org_context');
  });

  it('passes undefined thresholds when query params are non-numeric (Number.isFinite branch)', async () => {
    joinRows = [];
    await GET(getReq('minSampleSize=abc&maxTolerance=xyz'), {});
    const opts = detectCalibrationCandidates.mock.calls[0]?.[1] as {
      minSampleSize?: number;
      maxTolerance?: number;
    };
    expect(opts.minSampleSize).toBeUndefined();
    expect(opts.maxTolerance).toBeUndefined();
  });
});
