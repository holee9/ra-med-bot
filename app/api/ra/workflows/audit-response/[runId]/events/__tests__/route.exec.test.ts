// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for GET .../audit-response/[runId]/events (SPEC-REGULA-WORKFLOWS-LLM-002).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (AC-04 / REQ-WFLLM-002 / M4)

import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildEventsResponse = vi.fn(
  async (
    _runId: string,
    _userId: string,
    _orgId: string,
    opts: { wireInput: (input: unknown) => unknown },
  ) => {
    opts.wireInput({ deficiency: 'x' });
    return new Response(null, { status: 200 });
  },
);
const wireAuditResponseInput = vi.fn((input: unknown) => ({ wired: input }));
const executeAuditResponseStep = vi.fn();

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
vi.mock('@/lib/workflows/_shared/input-wiring', () => ({ wireAuditResponseInput }));
vi.mock('@/lib/workflows/audit-response/executor', () => ({
  executeStep: executeAuditResponseStep,
}));

const { GET } = await import('@/app/api/ra/workflows/audit-response/[runId]/events/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET .../audit-response/[runId]/events', () => {
  it('delegates to buildEventsResponse with workflowType audit_response and wires input', async () => {
    const res = await GET(new Request('http://localhost/events'), { params: { runId: 'r-1' } });
    expect(res.status).toBe(200);
    expect(buildEventsResponse).toHaveBeenCalledWith(
      'r-1',
      'user-001',
      'org-001',
      expect.objectContaining({ workflowType: 'audit_response' }),
    );
    expect(wireAuditResponseInput).toHaveBeenCalledWith(
      expect.objectContaining({ cerResults: null }),
    );
  });
});
