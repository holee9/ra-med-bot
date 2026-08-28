// @vitest-environment node
// @MX:NOTE [AUTO] Execution tests for POST /api/validation/report/export (SPEC-REGULA-VALIDATION-001).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-010, REQ-VAL-014, Issue #49)
//
// No prior test existed (0% coverage). The route spawns scripts/validation/build-report.ts;
// node:child_process.spawn is mocked with a controllable child emitter covering
// success / non-zero-exit / spawn-error / validation branches.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authenticated = true;
let organizationId = 'org-001';

/** Build a fake child whose registered stdout/close/error listeners fire async. */
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

const { POST } = await import('@/app/api/validation/report/export/route');

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/validation/report/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  organizationId = 'org-001';
});

describe('POST /api/validation/report/export (REQ-VAL-010/014)', () => {
  it('returns 200 with the (trimmed) report artifact path on success', async () => {
    spawn.mockImplementationOnce(() =>
      makeChild({ stdout: '/tmp/reports/v1.2.3.md\n', exitCode: 0 }),
    );
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.releaseId).toBe('v1.2.3');
    expect(body.reportArtifactPath).toBe('/tmp/reports/v1.2.3.md');
    expect(body.format).toBe('markdown');
  });

  it('returns 500 Report build failed on a non-zero exit code', async () => {
    spawn.mockImplementationOnce(() => makeChild({ stdout: 'boom', exitCode: 2 }));
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Report build failed');
    expect(body.releaseId).toBe('v1.2.3');
  });

  it('returns 500 Report builder invocation error when spawn emits an error', async () => {
    spawn.mockImplementationOnce(() => makeChild({ error: new Error('ENOENT') }));
    const res = await POST(postReq({ releaseId: 'v1.2.3' }), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Report builder invocation error');
  });

  it('returns 400 on an invalid releaseId format', async () => {
    const res = await POST(postReq({ releaseId: 'not-a-version' }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request body');
  });
});
