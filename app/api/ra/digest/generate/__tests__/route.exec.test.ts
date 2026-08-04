// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/ra/digest/generate (SPEC-REGULA-DIGEST-001).
// @MX:SPEC SPEC-REGULA-DIGEST-001

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let prefsQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async (_input: AuditInput) => {});
const generateWeeklyDigest = vi.fn();
const sendDigestEmail = vi.fn(async () => {});
const txUpdateWhere = vi.fn().mockResolvedValue(undefined);

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

vi.mock('@/lib/digest/digest-generator', () => ({ generateWeeklyDigest }));
vi.mock('@/lib/digest/email-sender', () => ({ sendDigestEmail }));

vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued prefs row.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(prefsQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
      ),
    },
  };
});

const { POST } = await import('@/app/api/ra/digest/generate/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/digest/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const digestPayload = { week_id: '2026-W28', updates: 5 };

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
  prefsQueue = [];
  generateWeeklyDigest.mockResolvedValue(digestPayload);
});

describe('POST /api/ra/digest/generate (SPEC-REGULA-DIGEST-001)', () => {
  it('returns 200 with the digest, no email when sendEmail is false', async () => {
    const res = await POST(postReq({ sendEmail: false }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.digest.week_id).toBe('2026-W28');
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it('sends the email + digest_emailed audit when recipients are configured', async () => {
    prefsQueue = [[{ recipientEmails: ['ra@example.com'] }]];
    const res = await POST(postReq({ sendEmail: true }), {});
    expect(res.status).toBe(200);
    expect(sendDigestEmail).toHaveBeenCalledWith('org-001', digestPayload, ['ra@example.com']);
    expect(auditCalls((i) => i.action === 'digest_emailed')).toHaveLength(1);
  });

  it('skips the email when no recipient emails are configured', async () => {
    prefsQueue = [[{ recipientEmails: [] }]];
    const res = await POST(postReq({ sendEmail: true }), {});
    expect(res.status).toBe(200);
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it('returns 400 Invalid JSON when the body is not JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/ra/digest/generate', { method: 'POST', body: '{bad' }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 Invalid input on a bad weekId format', async () => {
    const res = await POST(postReq({ weekId: '2026-28' }), {});
    expect(res.status).toBe(400);
  });

  it('returns 400 No organization when orgId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({}), {});
    expect(res.status).toBe(400);
  });
});
