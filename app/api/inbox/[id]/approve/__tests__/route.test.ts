// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/inbox/[id]/approve.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-028, REQ-V3-INBOX-012, Issue 320)
//
// Covers: RBAC (inbox.manage, ra-lead ONLY), ESIG re-auth (password required),
// IDOR defense, promoteToApproved error mapping, audit-on-failure (inbox.approve_failed).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock domain functions ---
const assertTicketInOrg = vi.fn();
const promoteToApproved = vi.fn();
const writeAudit = vi.fn();

// --- Mock withPermission ---
let authenticated = true;
let userRole: 'viewer' | 'ra-member' | 'ra-lead' | 'admin' = 'ra-lead';
let organizationId = 'org-001';

// Mirror the real RBAC: inbox.manage requires ra-lead/admin (other roles → 403).
const MANAGE_ROLES = new Set(['ra-lead', 'admin']);

// Mock bcrypt for password re-auth
const bcryptCompare = vi.fn();

// Mock user fetch for password re-auth.
// Route uses select({ passwordHash: users.password_hash }) — Drizzle aliases the
// result column to camelCase, so the mock must return `passwordHash` (not snake_case).
const mockUser = {
  id: 'user-001',
  passwordHash: '$2a$12$hashedpassword',
};
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([mockUser])),
      })),
    })),
  })),
};

vi.mock('@/lib/kernel/db/client', () => ({
  db: mockDb,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: bcryptCompare,
  },
}));

vi.mock('@/lib/kernel/auth/with-permission', () => ({
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

vi.mock('@/lib/domains/inbox', () => ({
  assertTicketInOrg,
  promoteToApproved,
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit,
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
  bcryptCompare.mockResolvedValue(true); // Default: password matches
  writeAudit.mockResolvedValue(undefined);
});

describe('POST /api/inbox/[id]/approve (REQ-V3-INBOX-028, REQ-V3-INBOX-012)', () => {
  it('promotes ticket with correct password + ESIG and returns 200', async () => {
    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'approved-by-lead' }),
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

  it('returns 401 when password is wrong (re-auth failure) + writes audit inbox.approve_failed', async () => {
    bcryptCompare.mockResolvedValue(false); // Wrong password

    const res = await POST(
      postReq('it-001', { password: 'wrong-password', esigSignature: 'approved-by-lead' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid password');
    // Audit failure MUST be written
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'user-001',
        action: 'inbox.approve_failed',
        resource_type: 'inbox_ticket',
        resource_id: 'it-001',
        meta_json: expect.objectContaining({
          reason: expect.stringContaining('password'),
          esig_failure: true,
        }),
      }),
    );
    // promoteToApproved should NOT be called
    expect(promoteToApproved).not.toHaveBeenCalled();
  });

  it('returns 400 when password is missing (Zod validation)', async () => {
    const res = await POST(
      postReq('it-001', { esigSignature: 'approved-by-lead' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when password is empty string (Zod validation)', async () => {
    const res = await POST(
      postReq('it-001', { password: '', esigSignature: 'approved-by-lead' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when esigSignature is missing (Zod validation)', async () => {
    const res = await POST(postReq('it-001', { password: 'correct-password' }), getCtx('it-001'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when esigSignature is empty string (Zod validation)', async () => {
    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: '' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 404 when ticket not found (promoteToApproved error)', async () => {
    promoteToApproved.mockRejectedValue(new Error('Ticket not found'));

    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 404 for cross-org ticket access (IDOR defense)', async () => {
    assertTicketInOrg.mockRejectedValue(new Error('Ticket not found'));

    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Ticket not found');
  });

  it('returns 500 for unexpected promotion errors', async () => {
    promoteToApproved.mockRejectedValue(new Error('Database connection failed'));

    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to promote ticket');
  });

  it('denies ra-member role with 403 (inbox.manage requires ra-lead)', async () => {
    userRole = 'ra-member';
    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    expect(res.status).toBe(403);
  });

  it('denies unauthenticated request with 401', async () => {
    authenticated = false;
    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when promoteToApproved throws validation error', async () => {
    promoteToApproved.mockRejectedValue(new Error('Cannot promote ticket without final_answer'));

    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Cannot promote ticket without final_answer');
  });

  it('writes audit inbox.approve_failed on promoteToApproved error (H-2 fix)', async () => {
    promoteToApproved.mockRejectedValue(new Error('Cannot promote ticket without final_answer'));

    const res = await POST(
      postReq('it-001', { password: 'correct-password', esigSignature: 'valid' }),
      getCtx('it-001'),
    );

    expect(res.status).toBe(400);
    // Audit failure MUST be written even on domain errors
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'user-001',
        action: 'inbox.approve_failed',
        resource_type: 'inbox_ticket',
        resource_id: 'it-001',
        meta_json: expect.objectContaining({
          reason: 'Cannot promote ticket without final_answer',
        }),
      }),
    );
  });
});
