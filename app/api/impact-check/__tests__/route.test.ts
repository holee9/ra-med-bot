// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/impact-check (SPEC-V3-IMPACT-001).
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-01..04, AC-IMP-09, AC-IMP-12, AC-IMP-13)
//
// No prior test existed (0% coverage). Invokes the real POST handler with the
// impact domain libs mocked so the 4-layer orchestration branches are exercised:
// high-confidence auto-approve (RAG similar cases), low-confidence manual review
// (ticket creation with signal-driven priority), missing-assignee fallback, and
// zod validation (400).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock state toggles ---
let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
const lookupRetestMatrix = vi.fn();
const classifyChangeCategory = vi.fn();
const calculateSignal = vi.fn();
const findSimilarCases = vi.fn();
const createImpactTicket = vi.fn();

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

vi.mock('@/lib/db/client', () => ({ db: {} }));

vi.mock('@/lib/domains/impact', () => ({
  lookupRetestMatrix,
  classifyChangeCategory,
  calculateSignal,
  findSimilarCases,
  createImpactTicket,
}));

const { POST } = await import('@/app/api/impact-check/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/impact-check', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validInput = {
  orgId: 'org-1',
  productId: 'prod-1',
  changeType: 'bom',
  markets: ['us', 'eu'],
  changeDetail: 'Replaced a capacitor in the power module.',
};

function classif(confidence: number) {
  return { category: 'design_change', confidence, reason: 'material swap' };
}

/** Extract audit inputs recorded by writeAudit, filtered by predicate. */
function auditCalls(predicate: (input: AuditInput) => boolean): AuditInput[] {
  return writeAudit.mock.calls
    .map((call) => (call as unknown[])[0] as AuditInput)
    .filter(predicate);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  lookupRetestMatrix.mockImplementation((_change: string, market: string) => ({
    level: 'minor',
    ref: `REF-${market}`,
    note: 'retest sample',
  }));
  classifyChangeCategory.mockResolvedValue(classif(0.5));
  calculateSignal.mockReturnValue('yellow');
  findSimilarCases.mockResolvedValue({
    cases: [{ id: 'c-1', title: 'prior swap', content: '...', similarity: 0.9 }],
  });
  createImpactTicket.mockResolvedValue('tkt-1');
});

describe('POST /api/impact-check — high-confidence path (AC-IMP-09)', () => {
  it('returns similar cases + auto-approve recommendation and skips ticket creation', async () => {
    classifyChangeCategory.mockResolvedValueOnce(classif(0.9));
    const res = await POST(postReq(validInput), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recommendation).toBe('high-confidence-auto-approve');
    expect(body.similarCases).toHaveLength(1);
    expect(body.ticketId).toBeUndefined();
    expect(findSimilarCases).toHaveBeenCalled();
    expect(createImpactTicket).not.toHaveBeenCalled();
  });
});

describe('POST /api/impact-check — low-confidence path (AC-IMP-09)', () => {
  it('creates a review ticket (priority high) when assignee is provided', async () => {
    const res = await POST(postReq({ ...validInput, assigneeId: 'ra-lead-1' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recommendation).toBe('low-confidence-manual-review');
    expect(body.ticketId).toBe('tkt-1');
    expect(createImpactTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: 'high', assigneeId: 'ra-lead-1' }),
    );
  });

  it('escalates ticket priority to critical when signal is red', async () => {
    calculateSignal.mockReturnValue('red');
    const res = await POST(postReq({ ...validInput, assigneeId: 'ra-lead-1' }), {});
    expect(res.status).toBe(200);
    expect(createImpactTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: 'critical', signal: 'red' }),
    );
  });

  it('skips ticket creation but keeps manual-review when no assignee is provided', async () => {
    const res = await POST(postReq(validInput), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recommendation).toBe('low-confidence-manual-review');
    expect(body.ticketId).toBeUndefined();
    expect(createImpactTicket).not.toHaveBeenCalled();
  });
});

describe('POST /api/impact-check — validation + audit (AC-IMP-01..04, AC-IMP-12)', () => {
  it('returns 400 on an invalid changeType enum', async () => {
    const res = await POST(postReq({ ...validInput, changeType: 'not-a-type' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid input');
  });

  it('writes an impact.check audit with signal + confidence meta', async () => {
    classifyChangeCategory.mockResolvedValueOnce(classif(0.9));
    await POST(postReq(validInput), {});
    const audits = auditCalls((i) => i.action === 'impact.check');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resource_type).toBe('impact_assessment');
    expect(audits[0]?.meta_json).toMatchObject({
      change_type: 'bom',
      markets: 'us,eu',
      confidence: 0.9,
    });
  });
});
