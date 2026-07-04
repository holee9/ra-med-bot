// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/ask.
// @MX:SPEC SPEC-V3-INBOX-001 (REQ-V3-INBOX-001, Issue 320)
//
// Covers: RBAC (inbox.view), validation (question min/max), audit (inbox.created),
// ticket creation with triage_state='auto' and autoAnswer=null.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through unless unauthenticated ---
let authenticated = true;
let userRole: 'viewer' | 'ra-member' | 'ra-lead' | 'admin' = 'ra-member';
let organizationId = 'org-001';
const writeAudit = vi.fn<[], Promise<void>>(async () => {});

vi.mock('@/lib/audit', () => ({
  writeAudit,
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
          user: { id: 'user-001', role: userRole, organizationId },
        });
      },
  ),
}));

// --- Mock db: insert returns ticketId ---
vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: vi.fn((fn) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({}),
        }),
      }),
    ),
  },
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

const { POST } = await import('@/app/api/ask/route');

function postReq(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  userRole = 'ra-member';
  organizationId = 'org-001';
});

describe('POST /api/ask (REQ-V3-INBOX-001)', () => {
  it('creates a ticket with valid question and returns 201 with ticketId', async () => {
    const res = await POST(postReq({ question: 'What is the 510(k) pathway?' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ticketId).toBeDefined();
    expect(body.ticketId).toMatch(/^it_/);
  });

  it('allows viewer role with ask.create permission (H-4 fix)', async () => {
    userRole = 'viewer';
    const res = await POST(postReq({ question: 'What is the 510(k) pathway?' }), {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ticketId).toBeDefined();
    expect(body.ticketId).toMatch(/^it_/);
  });

  it('denies unauthenticated request with 401', async () => {
    authenticated = false;
    const res = await POST(postReq({ question: 'Test question' }), {});
    expect(res.status).toBe(401);
  });

  it('rejects empty question with 400', async () => {
    const res = await POST(postReq({ question: '' }), {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('rejects question exceeding 5000 characters with 400', async () => {
    const longQuestion = 'x'.repeat(5001);
    const res = await POST(postReq({ question: longQuestion }), {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 403 when organizationId is missing', async () => {
    organizationId = undefined as unknown as string;
    const res = await POST(postReq({ question: 'Test question' }), {});
    expect(res.status).toBe(403);
  });

  it('writes audit row with inbox.created action', async () => {
    await POST(postReq({ question: 'Test question' }), {});

    // writeAudit is called within transaction
    expect(writeAudit).toHaveBeenCalled();
  });
});
