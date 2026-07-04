// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — PATCH /api/inbox/[id]/triage.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-015/021, Issue 320)
//
// Covers: RBAC (inbox.manage, ra-lead ONLY), state transition validation,
// IDOR defense, audit (inbox.triaged).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission ---
let authenticated = true;
let userRole: 'viewer' | 'ra-member' | 'ra-lead' | 'admin' = 'ra-lead';
let organizationId = 'org-001';

// Mirror the real RBAC: inbox.manage requires ra-lead/admin (other roles → 403).
const MANAGE_ROLES = new Set(['ra-lead', 'admin']);

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) => {
        if (!authenticated) {
          return Promise.resolve(Response.json({ error: 'Unauthorized' }, { status: 401 }));
        }
        if (action === 'inbox.manage' && !MANAGE_ROLES.has(userRole)) {
          return Promise.resolve(Response.json({ error: 'forbidden' }, { status: 403 }));
        }
        return handler(req, ctx, {
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

// --- Mock domain functions ---
const assertTicketInOrg = vi.fn();
const assertValidTransition = vi.fn();
const auditTransition = vi.fn();

vi.mock('@/lib/domains/inbox', () => ({
  assertTicketInOrg,
  assertValidTransition,
  auditTransition,
}));

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(() => ({
    DATABASE_URL: 'postgres://test',
    AUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost',
    AUTH_MICROSOFT_ID: 'test',
    AUTH_MICROSOFT_SECRET: 'test',
    AUTH_GOOGLE_ID: 'test',
    AUTH_GOOGLE_SECRET: 'test',
  })),
}));

// --- Mock db ---
const mockUpdate = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};

const mockLockFrom = vi.fn(() => ({
  where: vi.fn(() => ({
    for: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue([{ orgId: 'org-001' }]),
    })),
  })),
}));

const mockTx = {
  update: vi.fn(() => mockUpdate),
  // L-2 (Issue 321): in-tx SELECT FOR UPDATE re-verifies org_id.
  select: vi.fn(() => ({ from: mockLockFrom })),
};

const mockFrom = vi.fn(() => ({
  where: vi.fn(() => ({
    limit: vi.fn().mockResolvedValue([{ triageState: 'auto' }]),
  })),
}));

const db = {
  transaction: vi.fn((fn) => fn(mockTx)),
  select: vi.fn(() => ({ from: mockFrom })),
};

vi.mock('@/lib/db/client', () => ({ db }));

const { PATCH } = await import('@/app/api/inbox/[id]/triage/route');

function patchReq(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/inbox/${id}/triage`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function getCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  userRole = 'ra-lead';
  organizationId = 'org-001';
  assertTicketInOrg.mockResolvedValue(undefined);
  assertValidTransition.mockReturnValue(undefined);
  auditTransition.mockResolvedValue(undefined);
});

describe('PATCH /api/inbox/[id]/triage (REQ-V3-INBOX-015/021)', () => {
  it('transitions ticket to valid state with audit', async () => {
    const res = await PATCH(
      patchReq('it-001', { toState: 'needs-review', reason: 'Missing citation' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ticketId).toBe('it-001');
    expect(body.previousState).toBe('auto');
    expect(body.newState).toBe('needs-review');
    expect(assertValidTransition).toHaveBeenCalledWith('auto', 'needs-review');
    expect(auditTransition).toHaveBeenCalled();
  });

  it('returns 409 for invalid state transition (H-2 fix)', async () => {
    assertValidTransition.mockImplementation(() => {
      throw new Error('Cannot transition from auto to closed');
    });

    const res = await PATCH(patchReq('it-001', { toState: 'closed' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(409); // Changed from 400 to 409 (conflict status code)
    expect(body.error).toBe('Invalid state transition');
    expect(body.details).toBe('Cannot transition from auto to closed');
  });

  it('returns 404 for cross-org ticket access (IDOR defense)', async () => {
    assertTicketInOrg.mockRejectedValue(new Error('Ticket not found'));

    const res = await PATCH(patchReq('it-001', { toState: 'needs-review' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Ticket not found');
  });

  it('denies ra-member role with 403 (inbox.manage requires ra-lead)', async () => {
    userRole = 'ra-member';
    const res = await PATCH(patchReq('it-001', { toState: 'needs-review' }), getCtx('it-001'));
    expect(res.status).toBe(403);
  });

  it('denies unauthenticated request with 401', async () => {
    authenticated = false;
    const res = await PATCH(patchReq('it-001', { toState: 'needs-review' }), getCtx('it-001'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid toState', async () => {
    const res = await PATCH(patchReq('it-001', { toState: 'invalid-state' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 for missing toState', async () => {
    const res = await PATCH(patchReq('it-001', {}), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('accepts optional reason field', async () => {
    const res = await PATCH(
      patchReq('it-001', { toState: 'needs-review', reason: 'Requires expert review' }),
      getCtx('it-001'),
    );

    expect(res.status).toBe(200);
  });

  it('returns 400 when reason exceeds 500 characters', async () => {
    const longReason = 'x'.repeat(501);
    const res = await PATCH(
      patchReq('it-001', { toState: 'needs-review', reason: longReason }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });
});
