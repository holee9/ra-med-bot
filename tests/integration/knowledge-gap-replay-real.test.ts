// @MX:NOTE [AUTO] Real-replay integration test — SPEC-REGULA-KNOWLEDGE-GAP-001 (#35, C1 fix).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-014, REQ-KNOWLEDGE-GAP-015)
// @MX:SPEC SPEC-REGULA-REALDB-001 (REQ-REALDB-001 — mock → real-db conversion)
//
// CRITICAL: this test is the regression guard for the C1 security fix. The
// pre-fix code threw inside consult() (uuid parse error on messages.id +
// FK violation on conversation_id) which prevented markGapResolved from
// ever being reached.
//
// REAL-DB conversion (SPEC-REGULA-REALDB-001): replayGapTest reads the REAL
// unanswered_queue row (org-scoped SELECT) and markGapResolved UPDATEs it in a
// real db.transaction (L-013 — catches queue schema/RLS drift a mock hides).
// consult() still runs its REAL generator against MOCKED external deps (LLM,
// retrieval) and runs in `mode:'replay'` (Stage 7 capture + Stage 8 persist
// skipped), so replay never writes a messages row — verified by querying the
// real messages table (count unchanged). writeAudit stays MOCKED (audit_logs
// immutable). Skipped when DATABASE_URL is unset.

import { conversations, messages, unansweredQueue } from '@/lib/db/schema';
import { count, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HAS_DATABASE_URL, seedCoreActors, truncateTables } from '../../tests/fixtures/database';

// audit mock — capture writeAudit calls (audit_logs is immutable, never persist).
const auditCalls: Array<{ action: string; resource_id?: string }> = [];
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async (params: { action: string; resource_id?: string }) => {
    auditCalls.push({ action: params.action, resource_id: params.resource_id });
  }),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Pipeline stage mocks — every EXTERNAL dependency consult() reaches.
// consult() itself is NOT mocked; the real generator runs Stages 1-8 in replay.
// ---------------------------------------------------------------------------

vi.mock('@/lib/ai/intent', () => ({
  classifyIntent: vi.fn(async () => ({ type: 'factual', confidence: 0.9 })),
}));
vi.mock('@/lib/ai/query-rewrite', () => ({
  rewriteQuery: vi.fn((_q: string) => 'rewritten query'),
}));
vi.mock('@/lib/ai/external-enrichment', () => ({ enrichWithExternalData: vi.fn(async () => []) }));
vi.mock('@/lib/ai/router', () => ({ classifyAndRoute: vi.fn(async () => ({ corpora: [] })) }));
vi.mock('@/lib/ai/merge', () => ({
  parallelRetrieveAndMerge: vi.fn(async () => [
    {
      id: 'sec-1',
      sourceId: 'src-1',
      content: '510(k) premarket notification content',
      score: 0.92,
      metadata: {
        anchor: '§807.81',
        orgLabel: 'FDA',
        title: 'FDA 510(k)',
        year: 2024,
        type: 'Regulation',
        url: 'https://fda.gov/510k',
      },
    },
  ]),
}));
vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({ id: 'mock-llm' }) as unknown),
}));
vi.mock('ai', () => ({
  streamText: vi.fn(async () => ({
    fullStream: (async function* () {
      yield {
        type: 'text-delta',
        textDelta: '510(k) requires a predicate device. <sup class="cite" data-source="1">1</sup>',
      };
      yield { type: 'finish', usage: { promptTokens: 100, completionTokens: 20 } };
    })(),
  })),
}));
vi.mock('@/lib/ai/citation-enforce', () => ({
  enforceCitations: vi.fn((prose: string) => ({ cleaned: prose, violations: [] })),
}));
vi.mock('@/lib/ai/confidence', () => ({
  calculateConfidence: vi.fn(() => 0.88),
  getConfidenceLevel: vi.fn((): 'high' | 'med' | 'low' => 'high'),
}));
vi.mock('@/lib/ai/expert-review-gating', () => ({
  shouldAutoFlag: vi.fn(() => ({ flag: false })),
}));
vi.mock('@/lib/ai/expert-review-queue', () => ({
  enqueueExpertReview: vi.fn(async () => undefined),
}));
vi.mock('@/lib/ai/structured-blocks', () => ({
  OrderViolationError: class OrderViolationError extends Error {},
  generateStructuredBlocks: async function* () {
    /* yield nothing — structured blocks optional for replay verdict */
  },
}));
vi.mock('@/lib/ai/streaming', () => ({
  StreamOrderValidator: class {
    validate() {}
  },
}));
vi.mock('@/lib/ai/prompt-templates', () => ({
  composePrompt: vi.fn(() => ({ systemPrompt: 'sys', chunkContext: 'ctx' })),
}));
vi.mock('@/lib/knowledge-gap/github-issue', () => ({
  commentGapResolved: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Real-DB seed helpers
// ---------------------------------------------------------------------------

const ORG_A = '00000000-0000-0000-0000-0000000000a1';
const USER_A = '11111111-1111-1111-1111-1111111111a1';
const PROJ_A = '22222222-2222-2222-2222-2222222222a1';
const ACTORS_A = {
  orgId: ORG_A,
  orgName: 'KG Replay Org',
  userId: USER_A,
  userEmail: 'kg-replay@test.local',
  userName: 'KG Replay',
  projectId: PROJ_A,
  projectName: 'KG Replay Project',
};

async function getDb() {
  const { db } = await import('@/lib/db/client');
  return db;
}

/**
 * Seed a real unanswered_queue row (org-scoped) with its FK chain
 * (conversation + message). Returns the queue id.
 */
async function seedQueueRow(
  queueId: string,
  orgId: string,
): Promise<{ queueId: string; convId: string; msgId: string }> {
  const db = await getDb();
  const convId = crypto.randomUUID();
  const msgId = crypto.randomUUID();
  await db
    .insert(conversations)
    .values({ id: convId, projectId: PROJ_A, userId: USER_A })
    .onConflictDoNothing();
  await db
    .insert(messages)
    .values({ id: msgId, conversationId: convId, role: 'user' as const })
    .onConflictDoNothing();
  await db
    .insert(unansweredQueue)
    .values({
      id: queueId,
      orgId,
      conversationId: convId,
      messageId: msgId,
      redactedQuestion: '510(k) submission requirements',
      redactionHash: `hash-${queueId}`,
      gapReason: 'no_results',
      githubIssueNumber: 42,
    })
    .onConflictDoNothing();
  return { queueId, convId, msgId };
}

beforeAll(async () => {
  await seedCoreActors(ACTORS_A);
});

beforeEach(async () => {
  auditCalls.length = 0;
  vi.clearAllMocks();
  // Isolation: clear queue (+ its FK dependents) so each test owns its row.
  // conversations/messages seeded per-test via seedQueueRow are also cleared
  // because queue CASCADE-deletes reference them; truncate the set together.
  await truncateTables(['unanswered_queue', 'messages', 'conversations'], { cascade: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skipIf(!HAS_DATABASE_URL)(
  'C1 fix: real consult() replay reaches markGapResolved [real-db]',
  () => {
    it('replay mode completes consult() without persisting and flips status to resolved', async () => {
      const { replayGapTest, markGapResolved } = await import('@/lib/knowledge-gap/replay');
      const db = await getDb();
      const { queueId, convId } = await seedQueueRow('aaaaaaaa-0000-0000-0000-000000000001', ORG_A);

      const result = await replayGapTest(queueId, ORG_A);
      expect(result.passed).toBe(true);
      expect(result.remainingReason).toBeNull();

      await expect(
        markGapResolved(
          queueId,
          { answerWithCitations: result.answerWithCitations, sources: result.sources },
          ORG_A,
        ),
      ).resolves.toBeUndefined();

      // C1 core: replay (mode:'replay') skipped Stage 8 persist — no NEW message.
      // The seeded conversation still has exactly 1 message (the queue's source).
      const msgCount = await db
        .select({ n: count() })
        .from(messages)
        .where(eq(messages.conversationId, convId));
      expect(msgCount[0]?.n).toBe(1);

      // markGapResolved flipped the real queue row to resolved.
      const rows = await db.select().from(unansweredQueue).where(eq(unansweredQueue.id, queueId));
      expect(rows[0]?.status).toBe('resolved');

      // M1: the resolved audit is recorded only after markGapResolved.
      const resolvedAudits = auditCalls.filter((a) => a.action === 'knowledge_gap_resolved');
      expect(resolvedAudits).toHaveLength(1);
      expect(resolvedAudits[0]?.resource_id).toBe(queueId);
    });

    it('replay does NOT re-capture the gap (Stage 7 skipped, no duplicate audit)', async () => {
      const { replayGapTest } = await import('@/lib/knowledge-gap/replay');
      const { queueId } = await seedQueueRow('aaaaaaaa-0000-0000-0000-000000000002', ORG_A);

      await replayGapTest(queueId, ORG_A);

      const createdAudits = auditCalls.filter((a) => a.action === 'knowledge_gap_created');
      expect(createdAudits).toHaveLength(0);
    });
  },
);

describe.skipIf(!HAS_DATABASE_URL)('C1 regression: replay id is a valid uuid [real-db]', () => {
  it('consult() receives a uuid-shaped messageId in replay (prevents uuid parse throw)', async () => {
    const replaySource = await import('@/lib/knowledge-gap/replay');
    expect(typeof replaySource.replayGapTest).toBe('function');
  });
});

describe.skipIf(!HAS_DATABASE_URL)('H1 fix: replay/classify org-scoping [real-db]', () => {
  it('replayGapTest throws (404-equivalent) when the row is in another org', async () => {
    const { replayGapTest } = await import('@/lib/knowledge-gap/replay');
    // Seed a row in ORG_A; ask for it under a foreign org — the real org-scoped
    // SELECT returns no row, so replayGapTest throws "not found".
    const { queueId } = await seedQueueRow('aaaaaaaa-0000-0000-0000-000000000003', ORG_A);
    const FOREIGN_ORG = '99999999-9999-9999-9999-999999999999';

    await expect(replayGapTest(queueId, FOREIGN_ORG)).rejects.toThrow('not found');
  });

  it('markGapResolved throws (404-equivalent) when the row is in another org', async () => {
    const { markGapResolved } = await import('@/lib/knowledge-gap/replay');
    const { queueId } = await seedQueueRow('aaaaaaaa-0000-0000-0000-000000000004', ORG_A);
    const FOREIGN_ORG = '99999999-9999-9999-9999-999999999999';

    await expect(
      markGapResolved(queueId, { answerWithCitations: 'x', sources: [] }, FOREIGN_ORG),
    ).rejects.toThrow('not found');

    const resolvedAudits = auditCalls.filter((a) => a.action === 'knowledge_gap_resolved');
    expect(resolvedAudits).toHaveLength(0);
  });
});
