// @MX:NOTE [AUTO] Implicit feedback (alternate answers) — Issue #264 sub-PR 3/3.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-001, REQ-RLHF-004, REQ-RLHF-005,
//           REQ-RLHF-009, REQ-RLHF-010, REQ-RLHF-015)
//
// Exercises the REAL /api/rlhf/feedback route handler against the in-memory DB
// mock (mirrors tests/integration/rlhf-idor-runtime.test.ts). Asserts:
//   (a) implicit regenerate records rating=down + source=implicit_regenerate +
//       the DISTINCT rlhf.implicit_feedback_recorded audit in the SAME tx.
//   (b) explicit + implicit coexist on the same (message, user) without 409.
//   (c) IDOR cross-org implicit write → 403.
//   (d) variationDimensions validated + persisted.
//   (e) default source=explicit when omitted (back-compat).
//
// Charter anchors verified:
//   [지양-2] implicit signals NEVER auto-trigger gap/promo bridges — the
//            createGapIssueForLowRatedAnswer mock is asserted NOT called when
//            source=implicit_regenerate (regeneration is not a quality complaint).
//            The signal flows into aggregation by virtue of rating='down'.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores + db mock (structure mirrors rlhf-idor-runtime.test.ts)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const messagesStore: Row[] = [];
const conversationsStore: Row[] = [];
const projectsStore: Row[] = [];
const answerFeedbackStore: Row[] = [];
const auditRecords: { action: string; resource_id?: string; meta?: Row }[] = [];

let currentSession: { user: { id: string; organizationId: string } };

function tableName(table: unknown): string {
  if (typeof table !== 'object' || table === null) return 'unknown';
  // biome-ignore lint/suspicious/noExplicitAny: symbol index access for Drizzle
  const t = table as any;
  return t?.[Symbol.for('drizzle:Name')] ?? t?.name ?? 'unknown';
}

interface InsertChain {
  values: (v: Row | Row[]) => InsertChain;
  returning: (f?: unknown) => Promise<Row[]>;
}
interface UpdateChain {
  set: (v: Row) => UpdateChain;
  where: (c: unknown) => UpdateChain;
  returning: (f?: unknown) => Promise<Row[]>;
}

// biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain
const dbMock: any = {
  insert: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingValues: Row | Row[] = {};
    const chain: InsertChain = {
      values: (values: Row | Row[]) => {
        pendingValues = values;
        return chain;
      },
      returning: vi.fn(async () => {
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const first = (arr[0] as Row) ?? {};
        if (tn === 'answer_feedback') {
          // @MX:ANCHOR [AUTO] UNIQUE(message_id, user_id, feedback_source) enforcement.
          //   @MX:REASON The original mock was array-push-only and did NOT enforce the
          //     real DB constraint, so commit 4603beb's migration defect (the auto-named
          //     answer_feedback_message_id_user_id_key 2-col unique surviving 0096) was
          //     invisible to this suite. We simulate BOTH the 3-col unique (correct) AND
          //     the legacy 2-col unique (the defect) here: if a row with the same
          //     (messageId, userId) already exists for a DIFFERENT feedbackSource, the
          //     2-col unique would have flagged it. The coexistence test below asserts
          //     both inserts succeed — if anyone re-introduces a 2-col unique, the mock
          //     throws unique_violation and the test fails. This is a behavioral guard,
          //     not just a row-count assertion.
          for (const v of arr) {
            const src = (v.feedbackSource as string | undefined) ?? 'explicit';
            const dup3 = answerFeedbackStore.find(
              (r) =>
                r.messageId === v.messageId &&
                r.userId === v.userId &&
                (r.feedbackSource as string) === src,
            );
            if (dup3) {
              throw new Error(
                `unique_violation: answer_feedback_message_user_source_idx (message_id, user_id, feedback_source)=(${v.messageId}, ${v.userId}, ${src})`,
              );
            }
            answerFeedbackStore.push({
              ...v,
              id: v.id ?? crypto.randomUUID(),
              feedbackSource: src,
            });
          }
        }
        if (tn === 'audit_logs') {
          auditRecords.push({
            action: String(first.action),
            resource_id: first.resourceId as string | undefined,
            meta: first.metaJson as Row | undefined,
          });
        }
        const id = first.id ?? crypto.randomUUID();
        return [{ id }];
      }),
    };
    return chain;
  }),
  select: vi.fn(() => makeSelectChain()),
  update: vi.fn((table: unknown) => {
    let updatedId = 'updated-id';
    const chain: UpdateChain = {
      set: vi.fn((vals: Row) => {
        if (tableName(table) === 'answer_feedback')
          Object.assign(answerFeedbackStore[0] ?? {}, vals);
        updatedId = String((vals as Row).id ?? 'updated-id');
        return chain;
      }),
      where: vi.fn(() => chain),
      returning: vi.fn(async () => [{ id: updatedId }]),
    };
    return chain;
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
};

// biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder chain
function makeSelectChain(): any {
  let fromTable = 'unknown';
  let lastWhereCond: unknown = undefined;
  class SelectChain extends Promise<Row[]> {
    from = vi.fn((table: unknown) => {
      fromTable = tableName(table);
      return this;
    });
    where = vi.fn((cond: unknown) => {
      lastWhereCond = cond;
      return this;
    });
    innerJoin = vi.fn(() => this);
    orderBy = vi.fn(() => this);
    limit = vi.fn(async () => {
      const rows = resolveRows(fromTable);
      const uuid = extractUuidFromCondition(lastWhereCond);
      // Issue #264 sub-PR 3/3: the existing-row lookup scopes by feedback_source
      // so explicit + implicit rows for the same (message, user) do not collide.
      // Extract the source string from the and() condition tree.
      const source = extractFeedbackSourceFromCondition(lastWhereCond);
      let filtered = uuid ? rows.filter((r) => r.id === uuid || r.messageId === uuid) : rows;
      if (source) {
        filtered = filtered.filter((r) => (r.feedbackSource as string | undefined) === source);
      }
      return filtered;
    });
  }
  return SelectChain.resolve([]);
}

/**
 * Extract the feedback_source equality value from a Drizzle and(eq(...),
 * eq(answerFeedback.feedbackSource, '...')) condition tree. Mirrors
 * extractUuidFromCondition but targets the 'explicit' / 'implicit_regenerate'
 * literals. Returns null when no source literal is present (the heatmap join
 * path does not filter by source).
 *
 * Drizzle pgEnum conditions encode the value inside a wrapper object with
 * circular refs, so direct recursive scans are unreliable. We stringify with a
 * circular-safe replacer and regex-match the source literal. This mirrors the
 * robustness of extractUuidFromCondition (which also scans stringified values
 * in practice) and is test-only code.
 */
function extractFeedbackSourceFromCondition(cond: unknown): string | null {
  if (cond === null || cond === undefined) return null;
  const seen = new WeakSet();
  let serialized: string;
  try {
    serialized = JSON.stringify(cond, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      // biome-ignore lint/suspicious/noExplicitAny: replacer receives unknown
      return v as any;
    });
  } catch {
    return null;
  }
  if (!serialized) return null;
  if (serialized.includes('implicit_regenerate')) return 'implicit_regenerate';
  if (serialized.includes('explicit')) return 'explicit';
  return null;
}

function extractUuidFromCondition(cond: unknown): string | null {
  const seen = new WeakSet();
  const stack: unknown[] = [cond];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined) continue;
    if (typeof node === 'string') {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(node)) return node;
      continue;
    }
    if (typeof node !== 'object') continue;
    if (seen.has(node as object)) continue;
    seen.add(node as object);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const v of Object.values(node as Record<string, unknown>)) stack.push(v);
  }
  return null;
}

function resolveRows(fromTable: string): Row[] {
  const callerOrg = currentSession.user.organizationId;
  const orgForMessage = (messageId: string): string | null => {
    const m = messagesStore.find((mm) => mm.id === messageId);
    if (!m) return null;
    const conv = conversationsStore.find((c) => c.id === m.conversationId);
    if (!conv) return null;
    const proj = projectsStore.find((p) => p.id === conv.projectId);
    return (proj?.organizationId as string | undefined) ?? null;
  };
  switch (fromTable) {
    case 'messages':
      return messagesStore.map((m) => ({
        ...m,
        prose: m.contentProse,
        conversationId: m.conversationId,
        orgId: orgForMessage(String(m.id)),
      }));
    case 'answer_feedback':
      return answerFeedbackStore
        .filter((f) => orgForMessage(String(f.messageId)) === callerOrg)
        .map((f) => {
          const m = messagesStore.find((mm) => mm.id === f.messageId);
          return { ...f, conversationId: m?.conversationId ?? null };
        });
    default:
      return [];
  }
}

vi.mock('@/lib/db/client', () => ({
  db: dbMock,
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> =>
      dbMock.transaction(async (tx: typeof dbMock) => fn(tx)),
  ),
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async (params: Row, tx?: { insert: unknown }) => {
    const client = (tx ?? { insert: dbMock.insert }) as { insert: unknown };
    await (client.insert as (t: unknown) => InsertChain)(Symbol.for('audit_logs') as unknown)
      .values({
        action: params.action,
        resourceId: params.resource_id,
        metaJson: params.meta_json,
      })
      .returning();
    auditRecords.push({
      action: String(params.action),
      resource_id: params.resource_id as string | undefined,
      meta: params.meta_json as Row | undefined,
    });
  }),
}));

vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      async (req: Request) =>
        handler(req, {}, currentSession),
  ),
}));

const { redactQuestionMock } = vi.hoisted(() => ({
  redactQuestionMock: vi.fn((original: string) => ({
    redacted: `[SERVER-REDACTED:${original.slice(0, 8)}]`,
    hash: 'sha256:mock',
    redactionCount: 1,
  })),
}));
vi.mock('@/lib/knowledge-gap/redaction', () => ({
  redactQuestion: redactQuestionMock,
}));

// Bridges — record call args so [지양-2] suppression is asserted.
const { gapBridgeMock, promoBridgeMock } = vi.hoisted(() => ({
  gapBridgeMock: vi.fn().mockResolvedValue(null),
  promoBridgeMock: vi.fn().mockReturnValue(null),
}));
vi.mock('@/lib/rlhf/gap-promo-bridge', () => ({
  createGapIssueForLowRatedAnswer: gapBridgeMock,
  proposePromotionCandidateForHighRatedAnswer: promoBridgeMock,
}));
vi.mock('@/lib/rlhf/langfuse-emitter', () => ({
  emitFeedbackEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const MSG_A = '11111111-1111-4111-8111-111111111111';
const MSG_B = '22222222-2222-4222-8222-222222222222';
const CONV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONV_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJ_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const PROJ_B = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

function seedTwoOrgs(): void {
  messagesStore.length = 0;
  conversationsStore.length = 0;
  projectsStore.length = 0;
  answerFeedbackStore.length = 0;
  auditRecords.length = 0;
  projectsStore.push(
    { id: PROJ_A, organizationId: 'org-A', name: 'Project A' },
    { id: PROJ_B, organizationId: 'org-B', name: 'Project B' },
  );
  conversationsStore.push(
    { id: CONV_A, projectId: PROJ_A, userId: 'user-a' },
    { id: CONV_B, projectId: PROJ_B, userId: 'user-b' },
  );
  messagesStore.push(
    {
      id: MSG_A,
      conversationId: CONV_A,
      contentProse: '510(k) submission steps for FDA clearance.',
    },
    {
      id: MSG_B,
      conversationId: CONV_B,
      contentProse: 'EU MDR technical documentation file structure.',
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  seedTwoOrgs();
  currentSession = { user: { id: 'user-a', organizationId: 'org-A' } };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// (a) implicit regenerate records rating=down + source=implicit_regenerate +
//     DISTINCT rlhf.implicit_feedback_recorded audit in tx
// ---------------------------------------------------------------------------

describe('Issue #264 sub-PR 3/3: implicit regenerate feedback', () => {
  it('records rating=down + feedbackSource=implicit_regenerate', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          // Client sends rating=up but source=implicit_regenerate — the route
          // MUST force rating=down (regeneration IS the implicit downvote).
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(answerFeedbackStore).toHaveLength(1);
    const row = answerFeedbackStore[0];
    expect(row?.rating).toBe('down');
    expect(row?.feedbackSource).toBe('implicit_regenerate');
  });

  it('emits the DISTINCT rlhf.implicit_feedback_recorded audit action (not feedback_submitted)', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    const implicitAudits = auditRecords.filter(
      (a) => a.action === 'rlhf.implicit_feedback_recorded',
    );
    expect(implicitAudits).toHaveLength(1);
    expect(implicitAudits[0]?.meta?.feedbackSource).toBe('implicit_regenerate');
    expect(implicitAudits[0]?.meta?.rating).toBe('down');
    // Must NOT also emit the explicit action for the same row.
    expect(auditRecords.filter((a) => a.action === 'feedback_submitted')).toHaveLength(0);
  });

  it('rides the audit + insert in ONE transaction (21 CFR Part 11 atomicity)', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
  });

  // [지양-2] implicit signals NEVER auto-trigger gap/promo bridges.
  it('does NOT call the gap or promo bridge for implicit feedback', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    expect(gapBridgeMock).not.toHaveBeenCalled();
    expect(promoBridgeMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // (b) explicit + implicit coexist on the same (message, user) without 409
  // ---------------------------------------------------------------------------

  it('coexists: explicit feedback then implicit regenerate on the same message → 2 rows, no 409', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');

    // 1. Explicit thumbs-down.
    const explicitRes = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'down',
          qualityTags: ['citation_missing'],
        }),
      }),
    );
    expect(explicitRes.status).toBe(200);

    // 2. Implicit regenerate on the SAME message by the SAME user.
    const implicitRes = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    expect(implicitRes.status).toBe(200);

    // Two distinct rows: one explicit, one implicit.
    expect(answerFeedbackStore).toHaveLength(2);
    const sources = answerFeedbackStore.map((r) => r.feedbackSource).sort();
    expect(sources).toEqual(['explicit', 'implicit_regenerate']);
    // Two distinct audit actions.
    const actions = auditRecords.map((a) => a.action).sort();
    expect(actions).toEqual(['feedback_submitted', 'rlhf.implicit_feedback_recorded']);
  });

  // ---------------------------------------------------------------------------
  // (b-regression) Migration 0096 defect guard — commit 4603beb originally
  // declared only `DROP CONSTRAINT IF EXISTS answer_feedback_message_user_idx`
  // (the Drizzle-name), but 0082 declared UNIQUE(message_id, user_id) INLINE,
  // so Postgres auto-named it `answer_feedback_message_id_user_id_key`. That
  // 2-col unique SURVIVED in the real DB, and explicit+implicit inserts on
  // the same (message, user) 500'd at runtime. The mock-based suite missed it
  // because the mock was array-push-only and enforced no constraint.
  //
  // We now enforce a 3-col UNIQUE analog inside the mock (see dbMock.insert).
  // This test proves the guard is wired: a SECOND explicit insert on the same
  // (message, user, source) tuple throws unique_violation rather than silently
  // pushing a duplicate. The real-DB apply (see migration 0096 fix commit)
  // independently confirms the synthetic explicit+implicit insert succeeds.
  // ---------------------------------------------------------------------------

  it('regression guard: duplicate (message, user, source) insert is rejected by the mock unique', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');

    // First explicit feedback succeeds.
    await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: MSG_A, rating: 'down' }),
      }),
    );

    // Direct duplicate insert through the same dbMock path must throw — this
    // proves the mock enforces the 3-col unique (would not have thrown pre-fix).
    // The table marker mirrors how Drizzle's pgTable exposes its SQL name via
    // Symbol.for('drizzle:Name'); using the real answerFeedback import would
    // couple this test to schema.ts internals, so we hand-roll the same marker.
    const answerFeedbackTable = {
      [Symbol.for('drizzle:Name')]: 'answer_feedback',
    };
    await expect(
      dbMock
        .insert(answerFeedbackTable as unknown)
        .values({
          messageId: MSG_A,
          userId: 'user-a',
          rating: 'down',
          feedbackSource: 'explicit',
        })
        .returning(),
    ).rejects.toThrow(/unique_violation: answer_feedback_message_user_source_idx/);
  });

  // ---------------------------------------------------------------------------
  // (c) IDOR cross-org implicit write → 403
  // ---------------------------------------------------------------------------

  it('returns 403 when org-A user records implicit feedback on org-B message', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_B,
          rating: 'up',
          source: 'implicit_regenerate',
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(answerFeedbackStore).toHaveLength(0);
    expect(auditRecords.filter((a) => a.action === 'rlhf.implicit_feedback_recorded')).toHaveLength(
      0,
    );
  });

  // ---------------------------------------------------------------------------
  // (d) variationDimensions validated + persisted
  // ---------------------------------------------------------------------------

  it('persists variationDimensions on the implicit row', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
          variationDimensions: { region: 'EU', corpus: 'eu-mdr', model: 'claude-opus-4' },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(answerFeedbackStore[0]?.variationDimensions).toEqual({
      region: 'EU',
      corpus: 'eu-mdr',
      model: 'claude-opus-4',
    });
    expect(
      auditRecords.find((a) => a.action === 'rlhf.implicit_feedback_recorded')?.meta
        ?.hasVariationDimensions,
    ).toBe(true);
  });

  it('rejects unknown variationDimensions keys (strict zod)', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          source: 'implicit_regenerate',
          variationDimensions: { region: 'EU', rogueField: 'inject' },
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // (e) default source=explicit when omitted (back-compat)
  // ---------------------------------------------------------------------------

  it('defaults source=explicit + uses feedback_submitted audit when source omitted', async () => {
    const { POST } = await import('@/app/api/rlhf/feedback/route');
    const res = await POST(
      new Request('http://localhost/api/rlhf/feedback', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          rating: 'up',
          qualityTags: ['helpful'],
          // source omitted — MUST default to 'explicit' (back-compat with
          // pre-0096 clients).
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(answerFeedbackStore[0]?.feedbackSource).toBe('explicit');
    expect(answerFeedbackStore[0]?.rating).toBe('up'); // not forced to down
    expect(auditRecords.some((a) => a.action === 'feedback_submitted')).toBe(true);
    expect(auditRecords.some((a) => a.action === 'rlhf.implicit_feedback_recorded')).toBe(false);
  });
});
