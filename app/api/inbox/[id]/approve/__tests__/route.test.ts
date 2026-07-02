// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/inbox/[id]/approve.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-028, Issue #320)
//
// Covers: RBAC (inbox.manage, ra-lead ONLY), ESIG mandatory validation (Charter [지양-4]),
// IDOR defense, promoteToApproved error mapping.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission ---
let authenticated = true;
let userRole: 'viewer' | 'ra-member' | 'ra-lead' | 'admin' = 'ra-lead';
let organizationId = 'org-001';

// Mirror the real RBAC: inbox.manage requires ra-lead/admin (other roles → 403).
const MANAGE_ROLES = new Set(['ra-lead', 'admin']);

// Stub db client so route import does not spin up a real pg pool (OOM guard).
// Domain functions (promoteToApproved, assertTicketInOrg) are mocked separately,
// so db is never actually called at runtime in these tests.
vi.mock('@/lib/db/client', () => ({ db: {} }));

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
const promoteToApproved = vi.fn();

vi.mock('@/lib/domains/inbox', () => ({
  assertTicketInOrg,
  promoteToApproved,
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

const { POST } = await import('@/app/api/inbox/[id]/approve/route');

function postReq(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/inbox/${id}/approve`, {
    method: 'POST',
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
  promoteToApproved.mockResolvedValue(undefined);
});

describe('POST /api/inbox/[id]/approve (REQ-V3-INBOX-028)', () => {
  it('promotes ticket with ESIG signature and returns 200', async () => {
    const res = await POST(
      postReq('it-001', { esigSignature: 'approved-by-lead' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ticketId).toBe('it-001');
    expect(body.approved).toBe(true);
    // promoteToApproved(db, input) — db is the first arg (stubbed via vi.mock).
    expect(promoteToApproved).toHaveBeenCalledWith(expect.anything(), {
      ticketId: 'it-001',
      approverId: 'user-001',
      esigSignature: 'approved-by-lead',
    });
  });

  it('returns 400 when ESIG signature is missing (Charter [지양-4])', async () => {
    const res = await POST(postReq('it-001', {}), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when ESIG signature is empty string', async () => {
    const res = await POST(postReq('it-001', { esigSignature: '' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when promoteToApproved throws ESIG error', async () => {
    promoteToApproved.mockRejectedValue(new Error('ESIG signature required for promotion'));

    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('ESIG signature required');
  });

  it('returns 404 when ticket not found (promoteToApproved error)', async () => {
    promoteToApproved.mockRejectedValue(new Error('Ticket not found'));

    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 404 for cross-org ticket access (IDOR defense)', async () => {
    assertTicketInOrg.mockRejectedValue(new Error('Ticket not found'));

    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 500 for unexpected promotion errors', async () => {
    promoteToApproved.mockRejectedValue(new Error('Database connection failed'));

    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to promote ticket');
  });

  it('denies ra-member role with 403 (inbox.manage requires ra-lead)', async () => {
    userRole = 'ra-member';
    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    expect(res.status).toBe(403);
  });

  it('denies unauthenticated request with 401', async () => {
    authenticated = false;
    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when promoteToAvailable throws validation error', async () => {
    promoteToApproved.mockRejectedValue(new Error('Cannot promote ticket without final_answer'));

    const res = await POST(postReq('it-001', { esigSignature: 'valid' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Cannot promote ticket without final_answer');
  });
});
