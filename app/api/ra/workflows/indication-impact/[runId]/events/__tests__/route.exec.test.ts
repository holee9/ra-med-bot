// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET .../indication-impact/[runId]/events (SPEC-REGULA-WORKFLOWS-LLM-002).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (AC-04 / REQ-WFLLM-002 / M4)

import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildEventsResponse = vi.fn(
  // Invoke opts.wireInput so the route's arrow closure is covered.
  async (
    _runId: string,
    _userId: string,
    _orgId: string,
    opts: { wireInput: (input: unknown) => unknown },
  ) => {
    opts.wireInput({ indication: 'x' });
    return new Response(null, { status: 200 });
  },
);
const wireIndicationImpactInput = vi.fn((input: unknown) => ({ wired: input }));
const executeIndicationImpactStep = vi.fn();

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' } }),
  ),
}));
vi.mock('@/lib/workflows/_shared/events-route', () => ({ buildEventsResponse }));
vi.mock('@/lib/workflows/_shared/input-wiring', () => ({ wireIndicationImpactInput }));
vi.mock('@/lib/workflows/indication-impact/executor', () => ({
  executeStep: executeIndicationImpactStep,
}));

const { GET } = await import('@/app/api/ra/workflows/indication-impact/[runId]/events/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET .../indication-impact/[runId]/events', () => {
  it('delegates to buildEventsResponse with workflowType indication_impact and wires input', async () => {
    const res = await GET(new Request('http://localhost/events'), { params: { runId: 'r-1' } });
    expect(res.status).toBe(200);
    expect(buildEventsResponse).toHaveBeenCalledWith(
      'r-1',
      'user-001',
      'org-001',
      expect.objectContaining({ workflowType: 'indication_impact' }),
    );
    // The wireInput arrow was invoked → wireIndicationImpactInput called with pccpResults:null.
    expect(wireIndicationImpactInput).toHaveBeenCalledWith(
      expect.objectContaining({ pccpResults: null }),
    );
  });
});
