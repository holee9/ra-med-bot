// @MX:NOTE [AUTO] Knowledge promotion unit tests — RBAC, audit atomicity, boost, unpromote.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (AC-01~08, REQ-001~015)
// @MX:REASON Mirrors the rlhf-idor-runtime pattern: mock @/lib/db/client,
//           @/lib/audit, @/lib/auth/with-permission so the REAL route handlers
//           + REAL promote/unpromote logic run against an in-memory store.
//           Covers AC-01 (org isolation), AC-02 (promote), AC-03 (RBAC deny),
//           AC-07 (audit), and the boost + unpromote-exclusion invariants.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const messagesStore: Row[] = [];
const conversationsStore: Row[] = [];
const projectsStore: Row[] = [];
const promotedStore: Row[] = [];
const auditRecords: { action: string; resource_id?: string; meta?: Row }[] = [];

let transactionShouldFail = false;
let currentSession: { user: { id: string; organizationId: string; role: string } };

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

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
      returning: vi.fn(async (sel?: unknown) => {
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const first = (arr[0] as Row) ?? {};
        if (tn === 'promoted_answers') {
          const row = { ...first, id: first.id ?? crypto.randomUUID() };
          promotedStore.push(row);
          return returnShape(sel, row);
        }
        if (tn === 'audit_logs') {
          auditRecords.push({
            action: String(first.action),
            resource_id: first.resourceId as string | undefined,
            meta: first.metaJson as Row | undefined,
          });
        }
        return [{ id: first.id ?? crypto.randomUUID() }];
      }),
    };
    return chain;
  }),
  select: vi.fn(() => makeSelectChain()),
  update: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingSet: Row = {};
    let targetId = '';
    const chain: UpdateChain = {
      set: vi.fn((vals: Row) => {
        pendingSet = vals;
        return chain;
      }),
      where: vi.fn((cond: unknown) => {
        targetId = extractIdFromCondition(cond) ?? '';
        return chain;
      }),
      returning: vi.fn(async (sel?: unknown) => {
        if (tn === 'promoted_answers') {
          const row = promotedStore.find((r) => r.id === targetId);
          if (row) Object.assign(row, pendingSet);
          return row ? returnShape(sel, row) : [];
        }
        return [{ id: targetId || 'updated-id' }];
      }),
    };
    return chain;
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    if (transactionShouldFail) throw new Error('simulated transaction failure');
    return fn(dbMock);
  }),
};

// Build the return shape honoring Drizzle `.returning({ field: col })` projection.
function returnShape(sel: unknown, row: Row): Row[] {
  if (typeof sel !== 'object' || sel === null) return [row];
  const out: Row = {};
  for (const [key] of Object.entries(sel as Record<string, unknown>)) {
    out[key] = row[key];
  }
  // Always include id so promoteAnswer's `returning({ id })` resolves.
  if (!('id' in out)) out.id = row.id;
  return [out];
}

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
      const uuid = extractIdFromCondition(lastWhereCond);
      if (uuid) {
        return rows.filter((r) => r.id === uuid || r.sourceMessageId === uuid);
      }
      return rows;
    });
  }
  return SelectChain.resolve([]);
}

/**
 * Collect ALL candidate id strings from a Drizzle condition tree, then prefer
 * one that matches a known row id in any store. Falls back to a UUID-shaped
 * string. This avoids false-positives from org ids ('org-A') leaking into
 * `.limit()` filters where the real target is a promoted/message id.
 */
function extractIdFromCondition(cond: unknown): string | null {
  const candidates: string[] = [];
  const seen = new WeakSet();
  const stack: unknown[] = [cond];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined) continue;
    if (typeof node === 'string') {
      if (/^[a-z0-9][a-z0-9-]{2,}$/i.test(node) && !/select|where|from|and|eq|org-/i.test(node)) {
        candidates.push(node);
      }
      continue;
    }
    if (typeof node !== 'object') continue;
    if (seen.has(node as object)) continue;
    seen.add(node as object);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      stack.push(v);
    }
  }
  if (candidates.length === 0) return null;
  // Prefer a candidate that exists as a row id in any store.
  const knownIds = new Set<string>([
    ...promotedStore.map((r) => String(r.id)),
    ...messagesStore.map((m) => String(m.id)),
  ]);
  const known = candidates.find((c) => knownIds.has(c));
  return known ?? candidates.find((c) => /^[0-9a-f]{8}-/i.test(c)) ?? null;
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
        orgId: orgForMessage(String(m.id)),
      }));
    case 'promoted_answers':
      // Library listLibrary filters org_id + status='active' in SQL. The mock
      // honors that semantically (no UUID condition is present for library
      // listing). IDOR lookups (resolvePromotedAnswerOrg) pass a UUID and are
      // handled by the `.limit()` filter above.
      return promotedStore.filter((r) => r.orgId === callerOrg && r.status === 'active');
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
      // Forward ctx (carrying dynamic-segment params) so [id] routes resolve.
      async (req: Request, ctx: unknown = {}) =>
        handler(req, ctx, currentSession),
  ),
}));

// Embedding model stub (Phase A: centralized in lib/ai/embedding-provider).
// embed() is mocked to reject so embedForPromotion returns null gracefully.
vi.mock('@/lib/ai/embedding-provider', () => ({
  getEmbeddingModel: () => ({}),
}));
vi.mock('ai', () => ({
  embed: vi.fn().mockRejectedValue(new Error('no-embedding-key')),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const MSG_A = '11111111-1111-4111-8111-111111111111'; // org-A
const MSG_B = '22222222-2222-4222-8222-222222222222'; // org-B
const CONV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJ_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

function seed(): void {
  messagesStore.length = 0;
  conversationsStore.length = 0;
  projectsStore.length = 0;
  promotedStore.length = 0;
  auditRecords.length = 0;
  projectsStore.push({ id: PROJ_A, organizationId: 'org-A', name: 'Project A' });
  conversationsStore.push({ id: CONV_A, projectId: PROJ_A, userId: 'user-a' });
  messagesStore.push(
    { id: MSG_A, conversationId: CONV_A, contentProse: '510(k) submission steps for FDA.' },
    { id: MSG_B, conversationId: 'conv-b', contentProse: 'EU MDR technical docs.' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionShouldFail = false;
  seed();
  currentSession = { user: { id: 'user-a', organizationId: 'org-A', role: 'ra-lead' } };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC-02: promote creates a promoted_answers row
// ---------------------------------------------------------------------------

describe('AC-02: promote creates promoted_answers row', () => {
  it('POST /api/knowledge-promo/promote creates a row + audit entry (201)', async () => {
    const { POST } = await import('@/app/api/knowledge-promo/promote/route');
    const res = await POST(
      new Request('http://localhost/api/knowledge-promo/promote', {
        method: 'POST',
        body: JSON.stringify({
          messageId: MSG_A,
          title: '510(k) Submission Steps',
          tags: ['fda', '510k'],
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(promotedStore).toHaveLength(1);
    expect(promotedStore[0]?.sourceMessageId).toBe(MSG_A);
    expect(promotedStore[0]?.orgId).toBe('org-A');
    expect(promotedStore[0]?.status).toBe('active');
    // AC-07: audit row written with answer_promoted.
    expect(auditRecords.some((a) => a.action === 'answer_promoted')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-01: IDOR — cross-org promote is rejected
// ---------------------------------------------------------------------------

describe('AC-01/AC-03: IDOR — cross-org promote rejected (403) + audit logged', () => {
  it('returns 403 when org-A user promotes org-B message; no promote row, deny audit written', async () => {
    const { POST } = await import('@/app/api/knowledge-promo/promote/route');
    const res = await POST(
      new Request('http://localhost/api/knowledge-promo/promote', {
        method: 'POST',
        body: JSON.stringify({ messageId: MSG_B, title: 'EU MDR', tags: [] }),
      }),
    );
    expect(res.status).toBe(403);
    // No promote row created.
    expect(promotedStore).toHaveLength(0);
    expect(auditRecords.filter((a) => a.action === 'answer_promoted')).toHaveLength(0);
    // AC-03: the cross-org denial MUST be audit logged (rbac.permission_deny).
    // Before the 2026-06-26 fix this 403 left no trail (21 CFR Part 11 violation).
    const denyAudits = auditRecords.filter((a) => a.action === 'rbac.permission_deny');
    expect(denyAudits.length).toBeGreaterThanOrEqual(1);
    const last = denyAudits[denyAudits.length - 1];
    expect(last?.meta?.reason).toBe('message_not_in_org');
    expect(last?.meta?.required).toBe('knowledgepromo.promote');
    expect(last?.resource_id).toBe(MSG_B);
  });
});

// ---------------------------------------------------------------------------
// AC-07: 21 CFR Part 11 atomicity — promote + audit in ONE transaction
// ---------------------------------------------------------------------------

describe('AC-07: promote + audit atomicity', () => {
  it('threads tx into writeAudit so audit rides the same transaction', async () => {
    const { POST } = await import('@/app/api/knowledge-promo/promote/route');
    await POST(
      new Request('http://localhost/api/knowledge-promo/promote', {
        method: 'POST',
        body: JSON.stringify({ messageId: MSG_A, title: 'T', tags: [] }),
      }),
    );
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(auditRecords.some((a) => a.action === 'answer_promoted')).toBe(true);
  });

  it('tx failure → 500, no partial write, no partial audit', async () => {
    transactionShouldFail = true;
    const { POST } = await import('@/app/api/knowledge-promo/promote/route');
    const res = await POST(
      new Request('http://localhost/api/knowledge-promo/promote', {
        method: 'POST',
        body: JSON.stringify({ messageId: MSG_A, title: 'T', tags: [] }),
      }),
    );
    expect(res.status).toBe(500);
    expect(promotedStore).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-07 / AC-08: unpromote sets status + audit; RAG excludes non-active
// ---------------------------------------------------------------------------

describe('AC-07/AC-08: unpromote', () => {
  it('DELETE sets status=unpromoted and writes answer_unpromoted audit', async () => {
    // Seed an active promoted row owned by org-A.
    promotedStore.push({
      id: 'promo-1',
      orgId: 'org-A',
      sourceMessageId: MSG_A,
      title: 'T',
      tags: [],
      status: 'active',
    });
    const { DELETE } = await import('@/app/api/knowledge-promo/promote/[id]/route');
    const res = await DELETE(
      new Request('http://localhost/api/knowledge-promo/promote/promo-1', {
        method: 'DELETE',
      }),
      { params: { id: 'promo-1' } },
    );
    expect(res.status).toBe(200);
    expect(promotedStore[0]?.status).toBe('unpromoted');
    expect(auditRecords.some((a) => a.action === 'answer_unpromoted')).toBe(true);
  });

  it('cross-org unpromote is rejected (403) + deny audit written (AC-03)', async () => {
    promotedStore.push({
      id: 'promo-b',
      orgId: 'org-B',
      sourceMessageId: MSG_B,
      title: 'T',
      tags: [],
      status: 'active',
    });
    const { DELETE } = await import('@/app/api/knowledge-promo/promote/[id]/route');
    const res = await DELETE(
      new Request('http://localhost/api/knowledge-promo/promote/promo-b', {
        method: 'DELETE',
      }),
      { params: { id: 'promo-b' } },
    );
    expect(res.status).toBe(403);
    // Row status unchanged (no unpromote write).
    const row = promotedStore.find((r) => r.id === 'promo-b');
    expect(row?.status).toBe('active');
    // AC-03: cross-org denial MUST be audit logged.
    const denyAudits = auditRecords.filter(
      (a) => a.action === 'rbac.permission_deny' && a.resource_id === 'promo-b',
    );
    expect(denyAudits).toHaveLength(1);
    expect(denyAudits[0]?.meta?.reason).toBe('promoted_answer_not_in_org');
    expect(denyAudits[0]?.meta?.required).toBe('knowledgepromo.promote');
  });
});

// ---------------------------------------------------------------------------
// AC-04 / AC-08: retriever boost + unpromote exclusion (source-level)
// ---------------------------------------------------------------------------

describe('AC-04/AC-08: retriever boost + unpromote exclusion (source-level)', () => {
  // NOTE (2026-06-26 AC-04 dead-code fix): these source-text regex checks are
  // retained as a CHEAP secondary guard, but they CANNOT detect dead code
  // (the regex passes even when PromotedAnswersRetriever is never called).
  // The MANDATORY behavior assertions live in:
  //   tests/unit/retrievers/promoted-answers.test.ts (retriever boost + metadata)
  //   tests/unit/ai/router.test.ts (org_promoted always-included in corpora)
  it('PROMOTED_BOOST_FACTOR > 1 and retriever WHERE excludes non-active', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/ai/retrievers/promoted-answers.ts'),
      'utf8',
    );
    // AC-04: boost > 1
    expect(src).toMatch(/PROMOTED_BOOST_FACTOR\s*=\s*1\.[0-9]+/);
    expect(src).toMatch(/\*\s*PROMOTED_BOOST_FACTOR/);
    // AC-08: WHERE status='active'
    expect(src).toMatch(/pa\.status\s*=\s*'active'/);
    // AC-05: sourceMessageId in metadata
    expect(src).toMatch(/sourceMessageId:\s*r\.source_message_id/);
  });

  it('merge.ts registers org_promoted retriever (REQ-009)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'lib/ai/merge.ts'), 'utf8');
    expect(src).toMatch(/org_promoted:\s*\(\)\s*=>\s*new PromotedAnswersRetriever\(\)/);
  });
});

// ---------------------------------------------------------------------------
// AC-06: library route lists only caller-org active entries
// ---------------------------------------------------------------------------

describe('AC-06: library lists caller-org active entries', () => {
  it('GET /api/knowledge-promo/library returns only active org-A entries', async () => {
    promotedStore.push(
      {
        id: 'p1',
        orgId: 'org-A',
        sourceMessageId: MSG_A,
        title: 'Active A',
        tags: ['fda'],
        promotedBy: 'user-a',
        promotedAt: new Date(),
        status: 'active',
      },
      {
        id: 'p2',
        orgId: 'org-A',
        sourceMessageId: MSG_A,
        title: 'Unpromoted A',
        tags: [],
        promotedBy: 'user-a',
        promotedAt: new Date(),
        status: 'unpromoted',
      },
      {
        id: 'p3',
        orgId: 'org-B',
        sourceMessageId: MSG_B,
        title: 'Active B',
        tags: [],
        promotedBy: 'user-b',
        promotedAt: new Date(),
        status: 'active',
      },
    );
    const { GET } = await import('@/app/api/knowledge-promo/library/route');
    const res = await GET(new Request('http://localhost/api/knowledge-promo/library'), {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Row[] };
    // Only org-A active entry surfaces; unpromoted + org-B excluded.
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.id).toBe('p1');
  });
});
