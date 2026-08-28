// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for /api/ra/notifications/preferences (SPEC-REGULA-NOTIFICATIONS-001).
// @MX:SPEC SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-002)
//
// No prior test existed (0% coverage). Invokes GET/PATCH with db mocked as a
// chainable thenable over a per-test select queue. Covers: default-merge on GET,
// null-saved fallback, per-event partial merge on PATCH, invalid-json / validation
// / user_not_found paths, and the profile.update audit ride.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';
let selectQueue: unknown[][] = [];

type AuditInput = {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json?: Record<string, unknown>;
};

const writeAudit = vi.fn(async () => {});
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
          user: { id: 'user-001', role: 'ra-member', organizationId },
        });
      },
  ),
}));

// chainable thenable: `await` on select().from().where() pops the next queued row.
vi.mock('@/lib/db/client', () => {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  // Intentional thenable: `await` on the chain pops the next queued select result.
  // biome-ignore lint/suspicious/noThenProperty: deliberate chainable thenable for the db mock
  chain.then = (resolve: (v: unknown) => void) => resolve(selectQueue.shift() ?? []);
  return {
    db: {
      select: () => chain,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          update: () => ({ set: () => ({ where: txUpdateWhere }) }),
        }),
      ),
    },
  };
});

const { GET, PATCH } = await import('@/app/api/ra/notifications/preferences/route');

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/ra/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
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
  selectQueue = [];
});

describe('GET /api/ra/notifications/preferences (REQ-NOTIFY-002)', () => {
  it('returns 200 with saved prefs merged over defaults', async () => {
    selectQueue = [[{ notificationPref: { expert_review_assigned: { email: false } } }]];
    const res = await GET(new Request('http://localhost/api/ra/notifications/preferences'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    // Saved override applies.
    expect(body.preferences.expert_review_assigned.email).toBe(false);
    // Defaults still present for untouched events.
    expect(body.preferences.workflow_completed.email).toBe(true);
  });

  it('falls back to defaults when saved prefs are null', async () => {
    selectQueue = [[{ notificationPref: null }]];
    const res = await GET(new Request('http://localhost/api/ra/notifications/preferences'), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.preferences.knowledge_gap_detected.email).toBe(false);
  });

  it('returns 404 user_not_found when the user row is missing', async () => {
    selectQueue = [[]];
    const res = await GET(new Request('http://localhost/api/ra/notifications/preferences'), {});
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/ra/notifications/preferences', () => {
  it('returns 200 with per-event partial merge + profile.update audit', async () => {
    selectQueue = [[{ notificationPref: { workflow_completed: { email: true } } }]];
    const res = await PATCH(patchReq({ preferences: { workflow_completed: { slack: true } } }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    // Existing email kept, slack overridden.
    expect(body.preferences.workflow_completed).toEqual({ email: true, slack: true });
    const audits = auditCalls((i) => i.action === 'profile.update');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.meta_json?.changedEvents).toEqual(['workflow_completed']);
  });

  it('returns 400 Invalid JSON when the body is not JSON', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/ra/notifications/preferences', {
        method: 'PATCH',
        body: '{bad',
      }),
      {},
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });

  it('returns 400 Validation failed when preferences is malformed', async () => {
    const res = await PATCH(patchReq({ preferences: 'not-a-record' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 404 user_not_found when the user row is missing', async () => {
    selectQueue = [[]];
    const res = await PATCH(patchReq({ preferences: { workflow_completed: { slack: true } } }), {});
    expect(res.status).toBe(404);
  });
});
