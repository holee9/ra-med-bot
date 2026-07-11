// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/validation/oq (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M2, REQ-VAL-004, AC-3, Issue #49)
//
// No prior test existed (0% coverage). Spawns scripts/validation/collect-oq.ts;
// node:child_process.spawn is mocked with a controllable child emitter.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

function makeChild(opts: { stdout?: string; exitCode?: number; error?: Error }) {
  const listeners: Record<string, Array<(arg: unknown) => void>> = {
    data: [],
    close: [],
    error: [],
  };
  const child = {
    stdout: {
      on: (ev: string, cb: (arg: unknown) => void) => {
        if (ev !== 'data') return;
        const existing = listeners.data;
        if (existing) existing.push(cb);
        else listeners.data = [cb];
      },
    },
    on: (ev: string, cb: (arg: unknown) => void) => {
      const existing = listeners[ev];
      if (existing) existing.push(cb);
      else listeners[ev] = [cb];
    },
  };
  queueMicrotask(() => {
    if (opts.error) {
      for (const cb of listeners.error ?? []) cb(opts.error);
      return;
    }
    if (opts.stdout !== undefined)
      for (const cb of listeners.data ?? []) cb(Buffer.from(opts.stdout as string));
    for (const cb of listeners.close ?? []) cb(opts.exitCode ?? 0);
  });
  return child;
}

const spawn = vi.fn();

vi.mock('node:child_process', () => ({ spawn }));

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
          user: { id: 'user-001', role: 'admin', organizationId },
        });
      },
  ),
}));

const { POST } = await import('@/app/api/validation/oq/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/validation/oq', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
});

describe('POST /api/validation/oq (REQ-VAL-004)', () => {
  it('returns 200 with the collector JSON summary on success', async () => {
    const summary = { releaseId: 'v1.2.3', ciRuns: 42 };
    spawn.mockImplementationOnce(() => makeChild({ stdout: JSON.stringify(summary), exitCode: 0 }));
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
  });

  it('returns 500 OQ bundle collection failed on a non-zero exit code', async () => {
    spawn.mockImplementationOnce(() => makeChild({ stdout: 'x', exitCode: 2 }));
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('OQ bundle collection failed');
  });

  it('returns 500 Collector invocation error when spawn emits an error', async () => {
    spawn.mockImplementationOnce(() => makeChild({ error: new Error('ENOENT') }));
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Collector invocation error');
  });

  it('returns 400 on an invalid releaseId format', async () => {
    const res = await POST(postReq({ releaseId: 'bad' }), {});
    expect(res.status).toBe(400);
  });
});
