// @MX:NOTE [AUTO] Integration tests for calibration proposal + API route.
// @MX:SPEC SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3, REQ-RLHF-005/006/015)
// @MX:SPEC SPEC-REGULA-REALDB-001 (REQ-REALDB-001 — mock → real-db conversion)
// @MX:REASON Runtime counterpart to the pure detector tests. Exercises:
//   1. REQ-RLHF-015 / Charter [지양-2]: proposeCalibrationCandidate writes
//      status=pending ONLY (never applied_via_governance).
//   2. 21 CFR Part 11 §11.10(e): candidate + audit ride the SAME tx — a
//      mid-flight tx failure writes NEITHER (real db.transaction rollback).
//   3. C-2 IDOR: the route returns only caller-org aggregates (cross-org
//      feedback is invisible) — enforced by the real org-scoped 4-hop join.
//
// REAL-DB conversion (SPEC-REGULA-REALDB-001): withTenantScope wraps a REAL
// db.transaction; the candidate INSERT + the org-scoped feedback SELECT hit the
// live schema (L-013 — catches FK/column drift a mock hides). writeAudit stays
// MOCKED (audit_logs is immutable REQ-FND-044 — cannot truncate; the mock also
// simulates the in-transaction failure for the atomicity case). with-permission
// stays MOCKED (session injection). Skipped when DATABASE_URL is unset.

import {
  answerFeedback,
  calibrationCandidates,
  conversations,
  messages,
  organizations,
  projects,
  users,
} from '@/lib/db/schema';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HAS_DATABASE_URL, seedCoreActors, truncateTables } from '../../tests/fixtures/database';

type Row = Record<string, unknown>;

interface SessionShape {
  user: { id: string; organizationId: string };
}

// writeAudit mock — records calls + simulates the in-transaction failure that
// the atomicity case injects. audit_logs is immutable so we never persist here.
type AuditRecord = { action: string; resourceId?: string; meta?: Row; tx?: unknown };
const auditRecords: AuditRecord[] = [];
let auditShouldFail = false;
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(
    async (params: { action: string; resource_id?: string; meta_json?: Row }, tx?: unknown) => {
      if (auditShouldFail) throw new Error('simulated audit failure');
      auditRecords.push({
        action: params.action,
        resourceId: params.resource_id,
        meta: params.meta_json,
        tx,
      });
    },
  ),
}));

// with-permission mock — bypass SSO, inject a per-org session.
const session = { current: null as SessionShape | null };
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission:
    (_action: string, handler: (req: Request, ctx: unknown, s: SessionShape) => unknown) =>
    async (req: Request, ctx: unknown) => {
      const s = session.current;
      if (!s) throw new Error('no currentSession set');
      return handler(req, ctx, s);
    },
}));

async function getDb() {
  const { db } = await import('@/lib/db/client');
  return db;
}

// Two orgs for the IDOR case.
const ORG_A = '00000000-0000-0000-0000-0000000000a1';
const USER_A = '11111111-1111-1111-1111-1111111111a1';
const PROJ_A = '22222222-2222-2222-2222-2222222222a1';
const ORG_B = '00000000-0000-0000-0000-0000000000b1';
const USER_B = '11111111-1111-1111-1111-1111111111b1';
const PROJ_B = '22222222-2222-2222-2222-2222222222b1';

const ACTORS_A = {
  orgId: ORG_A,
  orgName: 'Calib Org A',
  userId: USER_A,
  userEmail: 'calib-a@test.local',
  userName: 'Calib A',
  projectId: PROJ_A,
  projectName: 'Calib Project A',
};

async function seedOrgB() {
  const db = await getDb();
  await db.insert(organizations).values({ id: ORG_B, name: 'Calib Org B' }).onConflictDoNothing();
  await db
    .insert(users)
    .values({ id: USER_B, email: 'calib-b@test.local', name: 'Calib B' })
    .onConflictDoNothing();
  await db
    .insert(projects)
    .values({ id: PROJ_B, organizationId: ORG_B, name: 'Calib Project B' })
    .onConflictDoNothing();
}

/** Seed N feedback rows for an org: messages at confidenceScore, given rating. */
async function seedFeedback(
  org: 'A' | 'B',
  count: number,
  confidenceScore: string,
  rating: 'up' | 'down',
): Promise<void> {
  const db = await getDb();
  const orgId = org === 'A' ? ORG_A : ORG_B;
  const projId = org === 'A' ? PROJ_A : PROJ_B;
  const userId = org === 'A' ? USER_A : USER_B;
  const convId = crypto.randomUUID();
  await db
    .insert(conversations)
    .values({ id: convId, projectId: projId, userId })
    .onConflictDoNothing();
  for (let i = 0; i < count; i++) {
    const msgId = crypto.randomUUID();
    await db
      .insert(messages)
      .values({ id: msgId, conversationId: convId, role: 'assistant' as const, confidenceScore })
      .onConflictDoNothing();
    await db
      .insert(answerFeedback)
      .values({ id: crypto.randomUUID(), messageId: msgId, userId, rating })
      .onConflictDoNothing();
  }
}

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/rlhf/calibration');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

async function loadRoute() {
  return await import('@/app/api/rlhf/calibration/route');
}
async function loadProposal() {
  return await import('@/lib/rlhf/calibration-proposal');
}

beforeAll(async () => {
  await seedCoreActors(ACTORS_A);
  await seedOrgB();
});

beforeEach(async () => {
  auditRecords.length = 0;
  auditShouldFail = false;
  session.current = { user: { id: USER_A, organizationId: ORG_A } };
  // Isolation: clear only the leaf domain tables under assertion. Do NOT include
  // conversations/messages — audit_logs FKs conversations (immutable REQ-FND-044),
  // so TRUNCATE conversations CASCADE reaches audit_logs and the immutability
  // trigger blocks it. These tests seed unique-uuid conversations/messages per
  // case (crypto.randomUUID), so they need no per-test truncation.
  await truncateTables(['calibration_candidates', 'answer_feedback']);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe.skipIf(!HAS_DATABASE_URL)(
  'proposeCalibrationCandidate — REQ-RLHF-015 / Charter [지양-2]/[지양-4] [real-db]',
  () => {
    it('writes status=pending ONLY (never applied_via_governance)', async () => {
      const { proposeCalibrationCandidate } = await loadProposal();
      await proposeCalibrationCandidate({
        orgId: ORG_A,
        proposedBy: USER_A,
        confidenceBucket: '0.8-1.0',
        bucketMidpoint: 0.9,
        observedUpRatio: 0.1,
        sampleSize: 6,
        verdict: 'overconfident',
      });

      const db = await getDb();
      const rows = await db.select().from(calibrationCandidates);
      expect(rows).toHaveLength(1);
      const candidate = rows[0];
      expect(candidate?.status).toBe('pending');
      expect(candidate?.verdict).toBe('overconfident');
      expect(candidate?.governanceChangeRequestId).toBeNull();
    });

    it('emits rlhf.calibration_proposed audit in the SAME transaction', async () => {
      const { proposeCalibrationCandidate } = await loadProposal();
      await proposeCalibrationCandidate({
        orgId: ORG_A,
        proposedBy: USER_A,
        confidenceBucket: '0.8-1.0',
        bucketMidpoint: 0.9,
        observedUpRatio: 0.1,
        sampleSize: 6,
        verdict: 'overconfident',
      });

      expect(auditRecords).toHaveLength(1);
      const audit = auditRecords[0] ?? { action: '', meta: {} };
      expect(audit.action).toBe('rlhf.calibration_proposed');
      expect(audit.meta?.confidence_bucket).toBe('0.8-1.0');
      expect(audit.meta?.verdict).toBe('overconfident');
      expect(audit.meta?.question).toBeUndefined();
      expect(audit.meta?.answer).toBeUndefined();
      // The audit shared the real tx (tx arg present, not undefined).
      expect(audit.tx).toBeDefined();
    });

    it('writes NEITHER candidate NOR audit when the transaction fails mid-flight (21 CFR Part 11 atomicity)', async () => {
      auditShouldFail = true; // writeAudit throws inside the real db.transaction
      const { proposeCalibrationCandidate } = await loadProposal();
      await expect(
        proposeCalibrationCandidate({
          orgId: ORG_A,
          proposedBy: USER_A,
          confidenceBucket: '0.8-1.0',
          bucketMidpoint: 0.9,
          observedUpRatio: 0.1,
          sampleSize: 6,
          verdict: 'overconfident',
        }),
      ).rejects.toThrow('simulated audit failure');

      const db = await getDb();
      const rows = await db.select().from(calibrationCandidates);
      expect(rows).toHaveLength(0); // real tx rolled back the candidate INSERT
      expect(auditRecords).toHaveLength(0); // mock recorded nothing (threw before push)
    });
  },
);

describe.skipIf(!HAS_DATABASE_URL)(
  'GET /api/rlhf/calibration — C-2 IDOR + detection view [real-db]',
  () => {
    it('returns only caller-org feedback aggregates (cross-org invisible)', async () => {
      await seedFeedback('A', 6, '0.90', 'down'); // org-a: 6 downvoted @0.9
      await seedFeedback('B', 1, '0.10', 'up'); // org-b: 1 upvoted @0.1 — invisible to org-a

      session.current = { user: { id: USER_A, organizationId: ORG_A } };
      const { GET } = await loadRoute();
      const res = await GET(makeRequest(), {});
      const body = await res.json();

      expect(res.status).toBe(200);
      const bucket = body.aggregates.find(
        (b: { confidenceBucket: string }) => b.confidenceBucket === '0.8-1.0',
      );
      expect(bucket).toBeDefined();
      expect(bucket?.sampleSize).toBe(6);
      expect(bucket?.observedUpRatio).toBe(0);
      // Org-B's lone upvote @0.1 is NOT visible to org-a: no 0.0-0.2 bucket.
      const orgBBucket = body.aggregates.find(
        (b: { confidenceBucket: string }) => b.confidenceBucket === '0.0-0.2',
      );
      expect(orgBBucket).toBeUndefined();
      expect(body.candidates).toHaveLength(1);
      expect(body.candidates[0]?.verdict).toBe('overconfident');
    });

    it('returns 403 when the session has no org context', async () => {
      session.current = { user: { id: 'user-x', organizationId: '' } };
      const { GET } = await loadRoute();
      const res = await GET(makeRequest(), {});
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('no_org_context');
    });

    it('returns an empty candidate list when no feedback exists', async () => {
      const { GET } = await loadRoute();
      const res = await GET(makeRequest(), {});
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.aggregates).toEqual([]);
      expect(body.candidates).toEqual([]);
    });

    it('accepts overridden thresholds via query params', async () => {
      await seedFeedback('A', 6, '0.90', 'down');
      const { GET } = await loadRoute();
      // With minSampleSize=10, the 6-sample bucket no longer qualifies.
      const res = await GET(makeRequest({ minSampleSize: '10' }), {});
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.candidates).toEqual([]);
      expect(body.thresholds.minSampleSize).toBe(10);
    });
  },
);
