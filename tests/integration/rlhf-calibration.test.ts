// @MX:NOTE [AUTO] Integration tests for calibration proposal + API route.
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006/015)
// @MX:REASON Runtime counterpart to the pure detector tests. Exercises:
//   1. REQ-RLHF-015 / Charter [지양-2]: proposeCalibrationCandidate writes
//      status=pending ONLY (never applied_via_governance).
//   2. 21 CFR Part 11 §11.10(e): candidate + audit ride the SAME tx — a
//      mid-flight tx failure writes NEITHER.
//   3. C-2 IDOR: the route returns only caller-org aggregates (cross-org
//      feedback is invisible).
//
// Strategy (mirrors tests/integration/rlhf-idor-runtime.test.ts):
//   - Mock @/lib/db/client (db + withTenantScope) with an in-memory store.
//   - Mock @/lib/auth/with-permission — bypass auth, inject a session per org.
//   - The REAL calibration-detector (pure) and the REAL route handler run.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted lifts the mock state + factories ABOVE the vi.mock calls so the
// hoisted mock factories can reference them without a TDZ error. Mirrors the
// pattern in tests/integration/rlhf-idor-runtime.test.ts.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface SessionShape {
  user: { id: string; organizationId: string };
}

const {
  calibrationStore,
  feedbackStore,
  messagesStore,
  conversationsStore,
  projectsStore,
  auditRecords,
  flags,
  session,
  dbMock,
  withTenantScopeMock,
  withPermissionMock,
} = vi.hoisted(() => {
  const calibrationStore: Row[] = [];
  const feedbackStore: Row[] = [];
  const messagesStore: Row[] = [];
  const conversationsStore: Row[] = [];
  const projectsStore: Row[] = [];
  const auditRecords: { action: string; resource_id?: string; meta?: Row }[] = [];
  const flags = { auditShouldFail: false, transactionShouldFail: false };
  const session: { current: SessionShape | null } = { current: null };

  function tableName(table: unknown): string {
    if (typeof table !== 'object' || table === null) return 'unknown';
    // biome-ignore lint/suspicious/noExplicitAny: symbol index access for Drizzle
    const t = table as any;
    return t?.[Symbol.for('drizzle:Name')] ?? t?.name ?? 'unknown';
  }

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain
  const dbMock: any = {
    insert: vi.fn((table: unknown) => {
      const tn = tableName(table);
      let pendingValues: Row | Row[] = {};
      // commitInsert is called from BOTH the .returning() chain method AND the
      // inherited-Promise .then path (writeAudit awaits .values() with no
      // .returning()). The `committed` guard makes it idempotent so a single
      // insert never double-writes when both paths fire.
      let committed = false;
      let committedResult: Row[] = [];
      function commitInsert(): Row[] {
        if (committed) return committedResult;
        committed = true;
        if (tn === 'audit_logs' && flags.auditShouldFail) {
          throw new Error('simulated audit failure');
        }
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const first = (arr[0] as Row) ?? {};
        // Generate the id ONCE so the stored row and the returned row agree
        // (Drizzle's defaultRandom produces a single id used for both).
        const generatedId = first.id ?? crypto.randomUUID();
        if (tn === 'calibration_candidates') {
          for (let i = 0; i < arr.length; i++) {
            const v = arr[i] as Row;
            const row = { ...v, id: i === 0 ? generatedId : (v.id ?? crypto.randomUUID()) };
            calibrationStore.push(row);
          }
        }
        if (tn === 'audit_logs') {
          auditRecords.push({
            action: String(first.action),
            resource_id: first.resourceId as string | undefined,
            meta: first.metaJson as Row | undefined,
          });
        }
        const firstRow = arr[0] as Row;
        committedResult = [{ ...firstRow, id: generatedId }];
        return committedResult;
      }
      // The insert chain extends Promise so `await client.insert(t).values(v)`
      // (the writeAudit call shape — no .returning()) resolves via the inherited
      // .then, AND .returning() is available for the calibration-proposal path.
      // Extending Promise avoids lint/suspicious/noThenProperty (then is
      // inherited, not a freshly-defined property). The commit is deferred via
      // queueMicrotask so it reads pendingValues AFTER .values() has set them.
      class InsertChain extends Promise<Row[]> {
        values = (values: Row | Row[]) => {
          pendingValues = values;
          return this;
        };
        returning = vi.fn(async () => commitInsert());
      }
      return new InsertChain((resolve) => {
        queueMicrotask(() => resolve(commitInsert()));
      });
    }),
    select: vi.fn(() => makeSelectChain()),
  };

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain
  function makeSelectChain(): any {
    class SelectChain extends Promise<Row[]> {
      from = vi.fn(() => this);
      innerJoin = vi.fn(() => this);
      where = vi.fn(() => this);
      orderBy = vi.fn(() => this);
      limit = vi.fn(() => this);
    }
    const orgId = session.current?.user.organizationId ?? '';
    const orgMessageIds = new Set(
      messagesStore
        .filter((m) => {
          const conv = conversationsStore.find((c) => c.id === m.conversationId);
          const proj = projectsStore.find((p) => p.id === conv?.projectId);
          return proj?.organizationId === orgId;
        })
        .map((m) => m.id),
    );
    const rows: Row[] = feedbackStore
      .filter((f) => orgMessageIds.has(f.messageId as string))
      .map((f) => {
        const msg = messagesStore.find((m) => m.id === f.messageId);
        return { confidenceScore: msg?.confidenceScore ?? null, rating: f.rating };
      });
    return SelectChain.resolve(rows);
  }

  const withTenantScopeMock = vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> => {
      if (flags.transactionShouldFail) {
        throw new Error('simulated transaction failure');
      }
      return fn(dbMock);
    },
  );

  const withPermissionMock = vi.fn(
    (_action: string, handler: (req: Request, ctx: unknown, session: SessionShape) => unknown) =>
      async (req: Request, _ctx: unknown) => {
        const s = session.current;
        if (!s) throw new Error('no currentSession set');
        return handler(req, _ctx, s);
      },
  );

  return {
    calibrationStore,
    feedbackStore,
    messagesStore,
    conversationsStore,
    projectsStore,
    auditRecords,
    flags,
    session,
    dbMock,
    withTenantScopeMock,
    withPermissionMock,
  };
});

vi.mock('@/lib/db/client', () => ({
  db: dbMock,
  withTenantScope: withTenantScopeMock,
}));

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: withPermissionMock,
}));

import { GET } from '@/app/api/rlhf/calibration/route';
import {
  proposeCalibrationCandidate,
  proposeCalibrationCandidates,
} from '@/lib/rlhf/calibration-proposal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedOrgAFeedback() {
  // 6 high-confidence (0.9) answers, all downvoted -> overconfident bucket.
  const projId = 'proj-org-a';
  const convId = 'conv-org-a';
  projectsStore.push({ id: projId, organizationId: 'org-a' });
  conversationsStore.push({ id: convId, projectId: projId });
  for (let i = 0; i < 6; i++) {
    const msgId = `msg-org-a-${i}`;
    messagesStore.push({ id: msgId, conversationId: convId, confidenceScore: '0.90' });
    feedbackStore.push({ messageId: msgId, rating: 'down' });
  }
}

function seedOrgBFeedback() {
  // Org-B owns one upvoted low-confidence answer (should be invisible to org-A).
  const projId = 'proj-org-b';
  const convId = 'conv-org-b';
  projectsStore.push({ id: projId, organizationId: 'org-b' });
  conversationsStore.push({ id: convId, projectId: projId });
  const msgId = 'msg-org-b-0';
  messagesStore.push({ id: msgId, conversationId: convId, confidenceScore: '0.10' });
  feedbackStore.push({ messageId: msgId, rating: 'up' });
}

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/rlhf/calibration');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  calibrationStore.length = 0;
  feedbackStore.length = 0;
  messagesStore.length = 0;
  conversationsStore.length = 0;
  projectsStore.length = 0;
  auditRecords.length = 0;
  flags.auditShouldFail = false;
  flags.transactionShouldFail = false;
  session.current = { user: { id: 'user-a', organizationId: 'org-a' } };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('proposeCalibrationCandidate — REQ-RLHF-015 / Charter [지양-2]/[지양-4]', () => {
  it('writes status=pending ONLY (never applied_via_governance)', async () => {
    await proposeCalibrationCandidate({
      orgId: 'org-a',
      proposedBy: 'user-a',
      confidenceBucket: '0.8-1.0',
      bucketMidpoint: 0.9,
      observedUpRatio: 0.1,
      sampleSize: 6,
      verdict: 'overconfident',
    });

    expect(calibrationStore).toHaveLength(1);
    const candidate = (calibrationStore[0] as Row) ?? {};
    expect(candidate.status).toBe('pending');
    expect(candidate.verdict).toBe('overconfident');
    expect(candidate.governanceChangeRequestId).toBeUndefined();
  });

  it('emits rlhf.calibration_proposed audit in the SAME transaction', async () => {
    await proposeCalibrationCandidate({
      orgId: 'org-a',
      proposedBy: 'user-a',
      confidenceBucket: '0.8-1.0',
      bucketMidpoint: 0.9,
      observedUpRatio: 0.1,
      sampleSize: 6,
      verdict: 'overconfident',
    });

    expect(auditRecords).toHaveLength(1);
    const audit = (auditRecords[0] as { action: string; resource_id?: string; meta?: Row }) ?? {
      action: '',
      resource_id: undefined,
      meta: undefined,
    };
    expect(audit.action).toBe('rlhf.calibration_proposed');
    expect(audit.resource_id).toBe(calibrationStore[0]?.id);
    expect(audit.meta?.confidence_bucket).toBe('0.8-1.0');
    expect(audit.meta?.verdict).toBe('overconfident');
    // PII guard: no question/answer text in meta.
    expect(audit.meta?.question).toBeUndefined();
    expect(audit.meta?.answer).toBeUndefined();
  });

  it('writes NEITHER candidate NOR audit when the transaction fails mid-flight (21 CFR Part 11 atomicity)', async () => {
    flags.transactionShouldFail = true;
    await expect(
      proposeCalibrationCandidate({
        orgId: 'org-a',
        proposedBy: 'user-a',
        confidenceBucket: '0.8-1.0',
        bucketMidpoint: 0.9,
        observedUpRatio: 0.1,
        sampleSize: 6,
        verdict: 'overconfident',
      }),
    ).rejects.toThrow('simulated transaction failure');

    expect(calibrationStore).toHaveLength(0);
    expect(auditRecords).toHaveLength(0);
  });
});

describe('proposeCalibrationCandidates — per-candidate isolation', () => {
  it('continues the batch when one candidate fails (others still persist)', async () => {
    // Two candidates: the first succeeds; the second is forced to fail by
    // flipping the audit flag AFTER the first proposal completes. Each
    // proposal does 2 inserts (candidate + audit), so we count proposals via
    // the withTenantScope wrapper, not raw inserts.
    const candidates = [
      {
        confidenceBucket: '0.8-1.0',
        bucketMidpoint: 0.9,
        observedUpRatio: 0.1,
        sampleSize: 6,
        verdict: 'overconfident' as const,
      },
      {
        confidenceBucket: '0.0-0.2',
        bucketMidpoint: 0.1,
        observedUpRatio: 0.9,
        sampleSize: 6,
        verdict: 'underconfident' as const,
      },
    ];

    // Make the SECOND proposal fail mid-flight: the first proposal runs the
    // original impl; a wrapper counts calls and throws on the 2nd, so that
    // tx (candidate + audit) is skipped — proving per-candidate isolation.
    let proposalCount = 0;
    const origImpl = withTenantScopeMock.getMockImplementation();
    withTenantScopeMock.mockImplementation(
      async <T>(orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> => {
        proposalCount += 1;
        if (proposalCount === 2) {
          throw new Error('simulated second-candidate tx failure');
        }
        // origImpl is erased to unknown at runtime (generic <T>); cast back.
        return (origImpl ? origImpl(orgId, fn) : fn(dbMock)) as Promise<T>;
      },
    );

    const out = await proposeCalibrationCandidates('org-a', 'user-a', candidates);
    expect(out).toHaveLength(1); // only the first succeeded
    expect(calibrationStore).toHaveLength(1);
    expect(calibrationStore[0]?.confidenceBucket).toBe('0.8-1.0');

    // Restore the original withTenantScope impl so the override does not leak.
    if (origImpl) withTenantScopeMock.mockImplementation(origImpl);
  });
});

describe('GET /api/rlhf/calibration — C-2 IDOR + detection view', () => {
  it('returns only caller-org feedback aggregates (cross-org invisible)', async () => {
    seedOrgAFeedback(); // org-a: 6 downvoted @0.9
    seedOrgBFeedback(); // org-b: 1 upvoted @0.1 — MUST be invisible to org-a

    session.current = { user: { id: 'user-a', organizationId: 'org-a' } };
    const res = await GET(makeRequest(), {});
    const body = await res.json();

    expect(res.status).toBe(200);
    // Org-A's 6 downvoted @0.9 land in the 0.8-1.0 bucket -> overconfident.
    const bucket = body.aggregates.find(
      (b: { confidenceBucket: string }) => b.confidenceBucket === '0.8-1.0',
    );
    expect(bucket).toBeDefined();
    expect(bucket?.sampleSize).toBe(6);
    expect(bucket?.observedUpRatio).toBe(0);
    // Org-B's lone upvote @0.1 is NOT visible: no 0.0-0.2 bucket in org-A's view.
    const orgBBucket = body.aggregates.find(
      (b: { confidenceBucket: string }) => b.confidenceBucket === '0.0-0.2',
    );
    expect(orgBBucket).toBeUndefined();
    // Candidate list reflects the overconfident bucket.
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]?.verdict).toBe('overconfident');
  });

  it('returns 403 when the session has no org context', async () => {
    session.current = { user: { id: 'user-x', organizationId: '' } };
    const res = await GET(makeRequest(), {});
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('no_org_context');
  });

  it('returns an empty candidate list when no feedback exists', async () => {
    // No seeding — org-a has zero feedback.
    const res = await GET(makeRequest(), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.aggregates).toEqual([]);
    expect(body.candidates).toEqual([]);
  });

  it('accepts overridden thresholds via query params', async () => {
    seedOrgAFeedback();
    // With minSampleSize=10, the 6-sample bucket no longer qualifies.
    const res = await GET(makeRequest({ minSampleSize: '10' }), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.candidates).toEqual([]);
    expect(body.thresholds.minSampleSize).toBe(10);
  });
});
