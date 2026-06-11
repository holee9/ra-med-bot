// @vitest-environment node
// @MX:NOTE [AUTO] TDD unit tests — POST /api/admin/predicate/cache/clear.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-022)
//
// Covers: dev-only department RBAC (dev allow; ra/exec deny → 403;
// unauthenticated → 401) and cache.invalidateAll() invocation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through unless unauthenticated ---
// When `authenticated` is false, the wrapper short-circuits with 401 (mirrors
// the real withPermission session guard).
let currentDepartment: 'RA' | 'Dev' | 'Exec' | 'External' | null = 'Dev';
let authenticated = true;

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
          user: { id: 'user-001', role: 'admin', organizationId: 'org-001' },
        });
      },
  ),
}));

// --- Mock db: department lookup returns currentDepartment ---
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => [{ department: currentDepartment }]),
    })),
  },
}));

// --- Mock predicate cache ---
const invalidateAll = vi.fn<[], Promise<void>>(async () => {});
vi.mock('@/lib/predicate/cache', () => ({
  createPredicateCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    invalidateAll,
  })),
}));

const { POST } = await import('@/app/api/admin/predicate/cache/clear/route');

function postReq(): Request {
  return new Request('http://localhost/api/admin/predicate/cache/clear', {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentDepartment = 'Dev';
  authenticated = true;
});

describe('POST /api/admin/predicate/cache/clear (REQ-PRE-022)', () => {
  it('clears the cache for a dev-department user and returns { cleared: true }', async () => {
    const res = await POST(postReq(), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cleared).toBe(true);
    expect(invalidateAll).toHaveBeenCalledOnce();
  });

  it('denies an RA-department user with 403', async () => {
    currentDepartment = 'RA';
    const res = await POST(postReq(), {});
    expect(res.status).toBe(403);
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it('denies an Exec-department user with 403', async () => {
    currentDepartment = 'Exec';
    const res = await POST(postReq(), {});
    expect(res.status).toBe(403);
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it('returns 401 for an unauthenticated request', async () => {
    authenticated = false;
    const res = await POST(postReq(), {});
    expect(res.status).toBe(401);
    expect(invalidateAll).not.toHaveBeenCalled();
  });
});
