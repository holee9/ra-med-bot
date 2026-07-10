// @MX:NOTE [AUTO] Route tests for POST /api/ra/classification (coverage 402, SPEC-REGULA-CLASSIFY-001).
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001, REQ-CLASSIFY-015)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mutable session: tests override to exercise org/403 branch ---
let sessionUser: { id: string; role: string; organizationId: string | null } = {
  id: 'user-001',
  role: 'ra-lead',
  organizationId: 'org-001',
};

// --- Mock withPermission: pass-through with injected session ---
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, { user: sessionUser }),
  ),
}));

// --- Mock db: transaction with insert chain ---
const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockDb = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ insert: vi.fn(() => mockInsertChain) }),
  ),
};

vi.mock('@/lib/db/client', () => ({ db: mockDb }));

// --- Mock audit ---
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock classification deps ---
const classifyDeviceMock = vi.fn();
vi.mock('@/lib/classification/classification-engine', () => ({
  classifyDevice: (...a: unknown[]) => classifyDeviceMock(...a),
}));

const parseDeviceIntentMock = vi.fn();
vi.mock('@/lib/classification/intent-parser', () => ({
  parseDeviceIntent: (...a: unknown[]) => parseDeviceIntentMock(...a),
}));

// --- Helpers ---
function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/ra/classification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost/api/ra/classification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
}

const VALID_BODY = {
  deviceDescription: 'A battery-powered cardiac pacemaker for chronic implantation.',
  deviceType: 'active',
  contactType: 'implant',
  hasSoftware: true,
  hasAiMl: false,
  isSterile: true,
};

const FIXED_RESULT = {
  fda: { deviceClass: 'class_iii', pathway: 'PMA' },
  eu: { deviceClass: 'class_iii', pathway: 'Annex IX', rule: 'MDR Rule 8' },
  mfds: { deviceClass: 'class_4' },
  nmpa: { deviceClass: 'class_iii' },
  pmda: { deviceClass: 'class_iv' },
};

const FIXED_INTENT = {
  deviceType: 'active',
  contactType: 'implant',
  hasSoftware: true,
  hasAiMl: false,
  isSterile: true,
};

/** Drain an SSE Response into an array of parsed event payloads. */
async function readSseEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  const events: Array<Record<string, unknown>> = [];
  for (const block of text.split('\n\n')) {
    const line = block.trim();
    if (line.startsWith('data: ')) {
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

describe('POST /api/ra/classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: 'org-001' };
    classifyDeviceMock.mockReturnValue(FIXED_RESULT);
    parseDeviceIntentMock.mockResolvedValue(FIXED_INTENT);
    mockInsertChain.returning.mockResolvedValue([{ id: 'cls-001' }]);
  });

  it('streams result + done events and persists with audit (200 SSE)', async () => {
    const { POST } = await import('@/app/api/ra/classification/route');
    const req = makePostRequest(VALID_BODY);
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await readSseEvents(res);
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain('parsing');
    expect(eventTypes).toContain('classifying');
    expect(eventTypes).toContain('result');
    expect(eventTypes).toContain('done');

    const resultEvent = events.find((e) => e.event === 'result');
    expect(resultEvent).toMatchObject({
      event: 'result',
      classificationId: 'cls-001',
    });

    expect(classifyDeviceMock).toHaveBeenCalled();
    expect(parseDeviceIntentMock).toHaveBeenCalledWith(VALID_BODY.deviceDescription);
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('calls writeAudit with device_classified action inside transaction', async () => {
    const { writeAudit } = await import('@/lib/audit');
    vi.mocked(writeAudit).mockClear();

    const { POST } = await import('@/app/api/ra/classification/route');
    const req = makePostRequest(VALID_BODY);
    const res = await POST(req, {});
    // Drain the SSE stream so the ReadableStream start() callback (which calls
    // writeAudit inside db.transaction) runs to completion before assertions.
    await res.text();

    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'device_classified',
        actor_id: 'user-001',
        resource_type: 'device_classification',
        resource_id: 'cls-001',
      }),
      expect.anything(),
    );
  });

  it('returns 403 when session has no organizationId', async () => {
    sessionUser = { id: 'user-001', role: 'ra-lead', organizationId: null };

    const { POST } = await import('@/app/api/ra/classification/route');
    const req = makePostRequest(VALID_BODY);
    const res = await POST(req, {});

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('No organization');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/ra/classification/route');
    const res = await POST(makeInvalidJsonRequest(), {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when deviceDescription is shorter than 10 chars', async () => {
    const { POST } = await import('@/app/api/ra/classification/route');
    const req = makePostRequest({ deviceDescription: 'short' });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
    expect(parseDeviceIntentMock).not.toHaveBeenCalled();
  });

  it('emits SSE error event when classifyDevice throws', async () => {
    classifyDeviceMock.mockImplementation(() => {
      throw new Error('classification engine crashed');
    });

    const { POST } = await import('@/app/api/ra/classification/route');
    const req = makePostRequest(VALID_BODY);
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toMatchObject({
      event: 'error',
      message: 'classification engine crashed',
    });
  });
});
