// @MX:NOTE [AUTO] Ops status API route tests — admin gate + snapshot serving.
// @MX:SPEC 운영 콘솔 (2026-10-20) — pattern follows existing route tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.fn();
const mockReadFile = vi.fn();

vi.mock('@/lib/kernel/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('node:fs', () => ({
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));

describe('GET /api/ops/status', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockReadFile.mockReset();
  });

  it('returns 403 for non-admin session', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'viewer' } });
    const { GET } = await import('@/app/api/ops/status/route');
    const res = await GET({} as never);
    expect(res.status).toBe(403);
  });

  it('returns 401 when auth is unavailable', async () => {
    mockAuth.mockRejectedValue(new Error('no auth'));
    const { GET } = await import('@/app/api/ops/status/route');
    const res = await GET({} as never);
    expect(res.status).toBe(401);
  });

  it('serves snapshot for admin', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'admin' } });
    const snapshot = { generatedAt: new Date().toISOString(), services: { http: [] } };
    mockReadFile.mockResolvedValue(JSON.stringify(snapshot));
    const { GET } = await import('@/app/api/ops/status/route');
    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ stale: false, generatedAt: snapshot.generatedAt });
  });

  it('flags stale snapshots and reports missing file as 503', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'admin' } });
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const { GET } = await import('@/app/api/ops/status/route');
    const res = await GET({} as never);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ stale: true });
  });
});
