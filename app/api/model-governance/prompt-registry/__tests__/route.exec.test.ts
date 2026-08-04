// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/model-governance/prompt-registry (SPEC-REGULA-MODEL-GOVERNANCE-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001)

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const auditPromptRegistered = vi.fn(async () => {});
const registerPrompt = vi.fn();
const listPrompts = vi.fn();
const safeParse = vi.fn();

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
          user: { id: 'user-001', role: 'ra-lead', organizationId },
        });
      },
  ),
}));

vi.mock('@/lib/model-governance/audit', () => ({ auditPromptRegistered }));
vi.mock('@/lib/model-governance/registry', () => ({ registerPrompt, listPrompts }));
vi.mock('@/lib/model-governance/types', () => ({
  registerPromptInputSchema: { safeParse },
}));

const { POST, GET } = await import('@/app/api/model-governance/prompt-registry/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/model-governance/prompt-registry', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validInput = { kind: 'prompt', content: 'You are an RA assistant.' };

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
  registerPrompt.mockResolvedValue({
    id: 'p-1',
    kind: 'prompt',
    version: 1,
    contentHash: 'abc123',
  });
  listPrompts.mockResolvedValue([{ id: 'p-1' }]);
  safeParse.mockReturnValue({ success: true, data: validInput });
});

describe('POST /api/model-governance/prompt-registry (REQ-MODELGOV-001)', () => {
  it('returns 201 + auditPromptRegistered on success', async () => {
    const res = await POST(postReq(validInput), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.prompt.id).toBe('p-1');
    expect(auditPromptRegistered).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'p-1', contentHash: 'abc123' }),
    );
  });

  it('returns 400 Invalid input when the schema rejects', async () => {
    safeParse.mockReturnValueOnce({ success: false, error: { flatten: () => ({}) } });
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(400);
  });

  it('returns 500 + error audit when registerPrompt throws', async () => {
    registerPrompt.mockRejectedValueOnce(new Error('hash collision'));
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(500);
    const audits = writeAudit.mock.calls.map((c) => (c as unknown[])[0] as AuditInput);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json?.error).toBe('hash collision');
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq(validInput), {});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/model-governance/prompt-registry', () => {
  it('returns 200 with prompts (no kind filter)', async () => {
    const res = await GET(new Request('http://localhost/api/model-governance/prompt-registry'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.prompts).toHaveLength(1);
    expect(listPrompts).toHaveBeenCalledWith('org-001', undefined);
  });

  it('passes kind=prompt through to listPrompts', async () => {
    await GET(new Request('http://localhost/api/model-governance/prompt-registry?kind=prompt'), {});
    expect(listPrompts).toHaveBeenCalledWith('org-001', 'prompt');
  });

  it('normalizes an unknown kind to undefined', async () => {
    await GET(
      new Request('http://localhost/api/model-governance/prompt-registry?kind=unknown'),
      {},
    );
    expect(listPrompts).toHaveBeenCalledWith('org-001', undefined);
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await GET(new Request('http://localhost/api/model-governance/prompt-registry'), {});
    expect(res.status).toBe(403);
  });
});
