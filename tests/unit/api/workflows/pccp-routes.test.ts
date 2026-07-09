// @MX:NOTE [AUTO] #391 — behavioral coverage for pccp create/approve tx atomicity.
// @MX:REASON Proves the workflows PR (#387) wraps INSERT/UPDATE + audit in ONE
//           db.transaction so a failure between them rolls back both (21 CFR
//           Part 11 §11.10(e)). The audit-wiring helpers MUST receive the same
//           `tx` the mutation rode — these tests assert exactly that.
// @MX:SPEC SPEC-REGULA-PCCP-001, Issue #391 (#378 evaluator residual)

import { describe, expect, it, vi } from 'vitest';

// --- Shared tx handle: db.transaction threads this same object to every
// mutation + audit inside the callback. The assertions compare against it. ---
const txMock = {
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [ROW]) })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
};
const ROW = {
  id: 'pccp-1',
  deviceId: 'dev-1',
  deviceName: 'Device',
  version: '1',
  status: 'draft',
  createdAt: new Date(),
};

const auditPccpCreated = vi.fn(async (_params: unknown, _tx?: unknown) => undefined);
const auditPccpExpertApproved = vi.fn(async (_params: unknown, _tx?: unknown) => undefined);
const auditPccpStatusChanged = vi.fn(async (_params: unknown, _tx?: unknown) => undefined);
const transitionPccpStatus = vi.fn(async (_params: { tx?: unknown }) => undefined);
const getActivePccpVersion = vi.fn(async () => null);
const buildBaselineSnapshot = vi.fn(() => ({}));
const validatePccpCompleteness = vi.fn(() => ({
  isComplete: true,
  completionPercentage: 100,
  missingComponents: [],
}));

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-1', role: 'ra-lead', organizationId: 'org-1' },
        }),
  ),
}));

vi.mock('@/lib/db/client', () => ({
  // db.transaction captures the tx it threads to the callback (txMock) so the
  // audit assertions can verify the SAME handle was forwarded.
  db: {
    transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    // approve route pre-checks: version SELECT (.limit) + components SELECT (no limit).
    // `.where()` returns an empty array that ALSO exposes `.limit` for the version lookup.
    select: vi.fn(() => {
      const arr: unknown[] = [];
      (arr as unknown as { limit: unknown }).limit = vi.fn(async () => [
        { id: 'pccp-1', status: 'draft' },
      ]);
      return { from: vi.fn(() => ({ where: vi.fn(() => arr) })) };
    }),
  },
}));

vi.mock('@/lib/pccp/audit-wiring', () => ({
  auditPccpCreated,
  auditPccpExpertApproved,
  auditPccpStatusChanged,
}));
vi.mock('@/lib/pccp/version-manager', () => ({
  transitionPccpStatus,
  getActivePccpVersion,
}));
vi.mock('@/lib/pccp/baseline-snapshot', () => ({ buildBaselineSnapshot }));
vi.mock('@/lib/pccp/validator', () => ({ validatePccpCompleteness }));
// Permissive input schema so the test focuses on the tx boundary, not Zod rules.
vi.mock('@/lib/workflows/types', () => ({
  PccpInputSchema: { safeParse: (b: unknown) => ({ success: true as const, data: b }) },
}));

const makePost = (body: unknown) =>
  new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('pccp create route — INSERT + audit ride ONE db.transaction (#391)', () => {
  it('forwards the transaction tx to auditPccpCreated (atomic with the INSERT)', async () => {
    const { POST } = await import('@/app/api/ra/workflows/pccp/route');
    auditPccpCreated.mockClear();
    txMock.insert.mockClear();

    const res = await POST(
      makePost({ device_id: 'dev-1', device_name: 'Device', manufacturer: 'Mfg', version: '1' }),
      {},
    );

    expect(res.status).toBe(201);
    // The audit MUST have received the same tx the INSERT rode.
    expect(auditPccpCreated).toHaveBeenCalledTimes(1);
    expect(auditPccpCreated.mock.calls[0]?.[1]).toBe(txMock);
    // And the INSERT used that tx (not the outer db).
    expect(txMock.insert).toHaveBeenCalled();
  });
});

describe('pccp approve route — UPDATE + 2 audits ride ONE db.transaction (#391)', () => {
  it('forwards the transaction tx to transitionPccpStatus + both audits (one atomic unit)', async () => {
    const { POST } = await import('@/app/api/ra/workflows/pccp/[id]/approve/route');
    transitionPccpStatus.mockClear();
    auditPccpExpertApproved.mockClear();
    auditPccpStatusChanged.mockClear();

    const res = await POST(makePost({}), { params: Promise.resolve({ id: 'pccp-1' }) });

    expect(res.status).toBe(200);
    // transitionPccpStatus received the tx in its params object.
    expect(transitionPccpStatus).toHaveBeenCalledTimes(1);
    expect(transitionPccpStatus.mock.calls[0]?.[0]?.tx).toBe(txMock);
    // Both audits received the same tx as their 2nd arg.
    expect(auditPccpExpertApproved).toHaveBeenCalledTimes(1);
    expect(auditPccpExpertApproved.mock.calls[0]?.[1]).toBe(txMock);
    expect(auditPccpStatusChanged).toHaveBeenCalledTimes(1);
    expect(auditPccpStatusChanged.mock.calls[0]?.[1]).toBe(txMock);
  });
});
