// @MX:NOTE [AUTO] T-010 TDD RED phase — withAuth session guard wrapper tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-058)

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

// Mock @/lib/auth — with-auth.ts calls auth() from here.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe('lib/api/with-auth.ts (REQ-BREADTH-058)', () => {
  it('with-auth.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'api', 'with-auth.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports withAuth function', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'api', 'with-auth.ts'), 'utf8');
    expect(src).toMatch(/export function withAuth/);
  });

  it('exports AuthContext interface', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'api', 'with-auth.ts'), 'utf8');
    expect(src).toMatch(/export interface AuthContext/);
  });

  it('returns 401 when no session exists', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { withAuth } = await import('@/lib/api/with-auth');
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);

    const req = new NextRequest('http://localhost/api/test');
    const res = await wrappedHandler(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringMatching(/unauthorized/i) });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when session has no organizationId', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user-1', email: 'test@example.com' },
      // organizationId deliberately absent
    } as never);

    const { withAuth } = await import('@/lib/api/with-auth');
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);

    const req = new NextRequest('http://localhost/api/test');
    const res = await wrappedHandler(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringContaining('organization') });
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler with AuthContext when session is valid', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: 'user-abc',
        email: 'user@corp.com',
        organizationId: 'org-xyz',
      },
    } as never);

    const { withAuth } = await import('@/lib/api/with-auth');
    const handler = vi.fn().mockResolvedValueOnce(NextResponse.json({ ok: true }));
    const wrappedHandler = withAuth(handler);

    const req = new NextRequest('http://localhost/api/test');
    const res = await wrappedHandler(req);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(req, {
      userId: 'user-abc',
      orgId: 'org-xyz',
      email: 'user@corp.com',
    });
    expect(res.status).toBe(200);
  });

  it('handler receives correct AuthContext fields', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        email: 'admin@medtech.com',
        organizationId: 'org-456',
      },
    } as never);

    const { withAuth } = await import('@/lib/api/with-auth');
    let capturedCtx: unknown;
    const handler = vi.fn().mockImplementation(async (_req, ctx) => {
      capturedCtx = ctx;
      return NextResponse.json({ success: true });
    });

    const req = new NextRequest('http://localhost/api/resource');
    await withAuth(handler)(req);

    expect(capturedCtx).toEqual({
      userId: 'user-123',
      orgId: 'org-456',
      email: 'admin@medtech.com',
    });
  });
});
