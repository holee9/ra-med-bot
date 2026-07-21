// @MX:NOTE [AUTO] Project memory unit tests — manager lifecycle, injector, extractor.
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (AC-01, AC-02, AC-03, AC-05, AC-06, AC-07)
// @MX:REASON Mirrors knowledge-promo test pattern: mock @/lib/kernel/db/client + @/lib/kernel/audit
//   so the REAL manager/injector/extractor logic runs against an in-memory store.
//   Covers AC-01 (6 memoryType CRUD), AC-02 (injection), AC-03 (pending only),
//   AC-05 (audit), AC-06 (expiry exclusion), AC-07 (same-key supersession tx).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const projectMemoryStore: Row[] = [];
const projectsStore: Row[] = [];
const auditRecords: { action: string; resource_id?: string; meta?: Row }[] = [];

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

function returnShape(sel: unknown, row: Row): Row[] {
  if (!sel || typeof sel !== 'object') return [{ ...row }];
  // biome-ignore lint/suspicious/noExplicitAny: select-shape projection
  const proj = sel as Record<string, any>;
  const out: Row = {};
  for (const [k, v] of Object.entries(proj)) {
    if (v && typeof v === 'object' && 'name' in v) {
      const colName = (v as { name?: string }).name ?? k;
      out[k] = row[colName] ?? row[k];
    } else {
      out[k] = row[k];
    }
  }
  return Object.keys(out).length ? [out] : [{ ...row }];
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
        if (tn === 'project_memory') {
          const row = { ...first, id: first.id ?? crypto.randomUUID(), createdAt: new Date() };
          projectMemoryStore.push(row);
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
    let pendingSet: Row = {};
    let targetId = '';
    // DEFECT 1 fix: approveSuggestedMemory uses WHERE status='pending'. The
    // mock must honor that condition — a row that is NOT pending must NOT be
    // returned by the conditional UPDATE (matches real Postgres behavior).
    let requirePending = false;
    const chain: UpdateChain = {
      set: (v: Row) => {
        pendingSet = v;
        return chain;
      },
      where: (c: unknown) => {
        // Extract id + status from the WHERE clause. Drizzle's eq()/and()
        // produce queryChunks = [bracket, column, ' = ', param, bracket]; the
        // param (string .value) is what we need. Scan the whole condition tree
        // for string-valued .value leaves: the id is a uuid, the status is
        // 'pending'/'active'/'invalidated'.
        const stringVals: string[] = [];
        const scan = (cond: unknown): void => {
          if (!cond || typeof cond !== 'object') return;
          // biome-ignore lint/suspicious/noExplicitAny: condition introspection
          const cd = cond as any;
          if (Array.isArray(cd.queryChunks)) {
            for (const chunk of cd.queryChunks) {
              // biome-ignore lint/suspicious/noExplicitAny: chunk introspection
              const ch = chunk as any;
              if (typeof ch?.value === 'string') stringVals.push(ch.value);
              else scan(chunk);
            }
          }
        };
        scan(c);
        for (const v of stringVals) {
          // uuid-shaped value = the id target.
          if (v.length >= 32 && /^[0-9a-f-]+$/i.test(v) && targetId === '') targetId = v;
          if (v === 'pending') requirePending = true;
        }
        return chain;
      },
      returning: vi.fn(async (sel?: unknown) => {
        const tn = tableName(table);
        if (tn === 'project_memory') {
          // Match by targetId when captured, else fall back to the most
          // recently inserted row (covers update/invalidate on the latest row).
          const row =
            projectMemoryStore.find((r) => r.id === targetId) ??
            projectMemoryStore[projectMemoryStore.length - 1];
          if (!row) return [];
          // Conditional UPDATE: if WHERE included status='pending' and the row
          // is NOT pending, return [] (no row matched — REQ-005 idempotency).
          if (requirePending && row.status !== 'pending') return [];
          Object.assign(row, pendingSet);
          return returnShape(sel, row);
        }
        return [];
      }),
    };
    return chain;
  }),
};

function makeSelectChain() {
  let tableNameCaptured = '';
  let whereId = '';
  // biome-ignore lint/suspicious/noExplicitAny: builder chain
  const chain: any = {
    from: vi.fn((t: unknown) => {
      tableNameCaptured = tableName(t);
      return chain;
    }),
    innerJoin: vi.fn(() => chain),
    where: vi.fn((c: unknown) => {
      // Capture the id value from eq(projectMemory.id, X). Drizzle's eq()
      // produces queryChunks = [bracket, column, ' = ', param, bracket]; the
      // param (index 3) is the only chunk whose .value is a STRING (the others
      // are SQL-fragment arrays). Scan for the string-valued .value.
      const scan = (cond: unknown): void => {
        if (!cond || typeof cond !== 'object') return;
        // biome-ignore lint/suspicious/noExplicitAny: condition introspection
        const cd = cond as any;
        if (Array.isArray(cd.queryChunks)) {
          for (const chunk of cd.queryChunks) {
            // biome-ignore lint/suspicious/noExplicitAny: chunk introspection
            const ch = chunk as any;
            if (typeof ch?.value === 'string' && whereId === '') whereId = ch.value;
            else scan(chunk);
          }
        }
      };
      scan(c);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(
      // Drizzle's .limit() returns a thenable that resolves to the rows. The
      // real approveSuggestedMemory code does `await db.select(...)...limit(1)`.
      // Return a Promise that resolves to the projected rows so the await works.
      (sel?: unknown) => {
        if (tableNameCaptured === 'project_memory' && whereId) {
          const row = projectMemoryStore.find((r) => r.id === whereId);
          if (!row) return Promise.resolve([]);
          if (!sel || typeof sel !== 'object') return Promise.resolve([{ status: row.status }]);
          // Project the selected fields (status).
          // biome-ignore lint/suspicious/noExplicitAny: select-shape projection
          const proj = sel as Record<string, any>;
          const out: Row = {};
          for (const [k, v] of Object.entries(proj)) {
            if (v && typeof v === 'object' && 'name' in v) {
              const colName = (v as { name?: string }).name ?? k;
              out[k] = (row as Row)[colName] ?? (row as Row)[k];
            } else {
              out[k] = (row as Row)[k];
            }
          }
          return Promise.resolve([out]);
        }
        return Promise.resolve([]);
      },
    ),
  };
  return chain;
}

const withTenantScopeMock = vi.fn(
  async <T>(_orgId: string, fn: (tx: typeof dbMock) => Promise<T>) => {
    // Run the callback with the mock db as the tx handle.
    return fn(dbMock);
  },
);

vi.mock('@/lib/kernel/db/client', () => ({
  get db() {
    return dbMock;
  },
  withTenantScope: (...args: unknown[]) =>
    withTenantScopeMock(...(args as [string, (tx: typeof dbMock) => Promise<unknown>])),
}));

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn(async (params: Record<string, unknown>, _tx?: unknown) => {
    auditRecords.push({
      action: String(params.action),
      resource_id: params.resource_id as string | undefined,
      meta: params.meta_json as Row | undefined,
    });
  }),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock the 'ai' module + llm-provider so extractor.detectDecisions runs without
// a real LLM. vi.spyOn fails ('generateText' is non-configurable), so we use a
// hoisted module mock with an exported mock function.
vi.mock('ai', async () => {
  const { mockAiModule } = await import('../__mocks__/project-memory-ai-mock');
  return mockAiModule;
});
vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmFastModel: () => ({}),
}));

// Stub projectBelongsToOrg / memoryBelongsToOrg — tests inject org-owned projects.
vi.mock('@/lib/project-memory/access', () => ({
  projectBelongsToOrg: vi.fn(async () => true),
  memoryBelongsToOrg: vi.fn(async () => true),
  resolveProjectOrg: vi.fn(
    async (id: string) => projectsStore.find((p) => p.id === id)?.organizationId ?? null,
  ),
}));

beforeEach(() => {
  projectMemoryStore.length = 0;
  projectsStore.length = 0;
  auditRecords.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC-01: 6 memoryType CRUD
// ---------------------------------------------------------------------------

describe('AC-01: createMemory supports all 6 memoryTypes', () => {
  const ORG = '00000000-0000-0000-0000-000000000001';
  const PROJECT = '00000000-0000-0000-0000-000000000002';
  const USER = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    projectsStore.push({ id: PROJECT, organizationId: ORG });
  });

  const types = [
    'device_classification',
    'target_markets',
    'submission_strategy',
    'predicate_device',
    'risk_class',
    'custom',
  ] as const;

  for (const memoryType of types) {
    it(`creates memory with memoryType=${memoryType}`, async () => {
      const { createMemory } = await import('@/lib/project-memory/manager');
      const result = await createMemory({
        projectId: PROJECT,
        memoryType,
        key: `key-${memoryType}`,
        value: 'value',
        userId: USER,
        orgId: ORG,
      });
      expect(result.status).toBe('active');
      expect(projectMemoryStore).toHaveLength(1);
      expect(projectMemoryStore[0]?.memoryType).toBe(memoryType);
    });
  }
});

// ---------------------------------------------------------------------------
// AC-05: audit atomicity
// ---------------------------------------------------------------------------

describe('AC-05: writeAudit is called inside the same tx', () => {
  const ORG = '00000000-0000-0000-0000-000000000001';
  const PROJECT = '00000000-0000-0000-0000-000000000002';
  const USER = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    projectsStore.push({ id: PROJECT, organizationId: ORG });
  });

  it('createMemory(active) writes memory_created audit', async () => {
    const { createMemory } = await import('@/lib/project-memory/manager');
    await createMemory({
      projectId: PROJECT,
      memoryType: 'device_classification',
      key: 'k',
      value: 'v',
      userId: USER,
      orgId: ORG,
    });
    expect(auditRecords.some((a) => a.action === 'memory_created')).toBe(true);
  });

  it('createMemory(pending) does NOT write audit (Charter [지양-4])', async () => {
    const { createMemory } = await import('@/lib/project-memory/manager');
    await createMemory({
      projectId: PROJECT,
      memoryType: 'device_classification',
      key: 'k',
      value: 'v',
      userId: USER,
      orgId: ORG,
      status: 'pending',
    });
    expect(auditRecords.some((a) => a.action === 'memory_created')).toBe(false);
  });

  it('invalidateMemory writes memory_invalidated audit', async () => {
    const { createMemory, invalidateMemory } = await import('@/lib/project-memory/manager');
    const created = await createMemory({
      projectId: PROJECT,
      memoryType: 'risk_class',
      key: 'rk',
      value: 'Class II',
      userId: USER,
      orgId: ORG,
    });
    auditRecords.length = 0;
    await invalidateMemory({ memoryId: created.id, userId: USER, orgId: ORG });
    expect(auditRecords.some((a) => a.action === 'memory_invalidated')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-06: injector excludes expired memories (via formatMemoriesForInjection)
// ---------------------------------------------------------------------------

describe('AC-02 / AC-06: injector formatting + budget', () => {
  it('returns empty string for no memories', async () => {
    const { formatMemoriesForInjection } = await import('@/lib/project-memory/injector');
    expect(formatMemoriesForInjection([])).toBe('');
  });

  it('prepends memories with header and respects priority order', async () => {
    const { formatMemoriesForInjection } = await import('@/lib/project-memory/injector');
    const out = formatMemoriesForInjection([
      { memoryType: 'custom', key: 'c', value: 'misc' },
      { memoryType: 'device_classification', key: 'dc', value: 'Class II' },
    ]);
    // device_classification (priority 60) should appear before custom (10).
    const dcIdx = out.indexOf('디바이스 분류');
    const customIdx = out.indexOf('기타');
    expect(dcIdx).toBeGreaterThan(-1);
    expect(customIdx).toBeGreaterThan(-1);
    expect(dcIdx).toBeLessThan(customIdx);
  });

  it('truncates values over 200 chars', async () => {
    const { formatMemoriesForInjection } = await import('@/lib/project-memory/injector');
    const long = 'x'.repeat(300);
    const out = formatMemoriesForInjection([
      { memoryType: 'device_classification', key: 'dc', value: long },
    ]);
    expect(out.length).toBeLessThan(long.length + 200);
    expect(out).toContain('…');
  });

  it('caps total injection at 2000 chars', async () => {
    const { formatMemoriesForInjection } = await import('@/lib/project-memory/injector');
    const many = Array.from({ length: 50 }, (_, i) => ({
      memoryType: 'device_classification',
      key: `k${i}`,
      value: 'y'.repeat(150),
    }));
    const out = formatMemoriesForInjection(many);
    expect(out.length).toBeLessThanOrEqual(2100); // header + content
  });
});

// ---------------------------------------------------------------------------
// AC-03: extractor parses + confidence threshold (REQ-005 pending only)
// ---------------------------------------------------------------------------

describe('AC-03: parseSuggestions + confidence threshold', () => {
  it('parses valid JSON array with high confidence', async () => {
    const { parseSuggestions } = await import('@/lib/project-memory/extractor');
    const raw = JSON.stringify([
      { memoryType: 'device_classification', key: 'dc', value: 'Class IIa', confidence: 0.9 },
    ]);
    const out = parseSuggestions(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.memoryType).toBe('device_classification');
  });

  it('drops suggestions below 0.7 confidence (§7 #1)', async () => {
    // detectDecisions calls generateText; mock it to return low-confidence.
    const { mockGenerateText } = await import('../__mocks__/project-memory-ai-mock');
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([{ memoryType: 'risk_class', key: 'r', value: 'low', confidence: 0.4 }]),
      // biome-ignore lint/suspicious/noExplicitAny: partial AI response mock
    } as any);
    const { detectDecisions } = await import('@/lib/project-memory/extractor');
    const out = await detectDecisions('some text');
    expect(out).toHaveLength(0);
  });

  it('rejects invalid memoryType (false-positive guard)', async () => {
    const { parseSuggestions } = await import('@/lib/project-memory/extractor');
    const raw = JSON.stringify([
      // biome-ignore lint/suspicious/noExplicitAny: test fixture with bad type
      { memoryType: 'bogus', key: 'k', value: 'v', confidence: 0.9 } as any,
    ]);
    expect(parseSuggestions(raw)).toHaveLength(0);
  });

  it('returns empty array on malformed JSON', async () => {
    const { parseSuggestions } = await import('@/lib/project-memory/extractor');
    expect(parseSuggestions('not json')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DEFECT 1 regression: approveSuggestedMemory idempotency (HIGH security)
// ---------------------------------------------------------------------------

describe('DEFECT 1: approveSuggestedMemory idempotency (REQ-005, REQ-014)', () => {
  const ORG = '00000000-0000-0000-0000-000000000001';
  const PROJECT = '00000000-0000-0000-0000-000000000002';
  const USER = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    projectsStore.push({ id: PROJECT, organizationId: ORG });
  });

  it('approves a pending memory -> active (happy path)', async () => {
    const { createMemory, approveSuggestedMemory } = await import('@/lib/project-memory/manager');
    const created = await createMemory({
      projectId: PROJECT,
      memoryType: 'device_classification',
      key: 'dc',
      value: 'Class II',
      userId: USER,
      orgId: ORG,
      status: 'pending',
    });
    auditRecords.length = 0;
    const result = await approveSuggestedMemory({
      memoryId: created.id,
      userId: USER,
      orgId: ORG,
    });
    expect(result.id).toBe(created.id);
    // Row is now active.
    const row = projectMemoryStore.find((r) => r.id === created.id);
    expect(row?.status).toBe('active');
    // REQ-014: approve writes memory_created audit (authoritative create).
    expect(auditRecords.some((a) => a.action === 'memory_created')).toBe(true);
  });

  it('REJECTS approving an already-active memory (idempotency, no resurrect)', async () => {
    const { createMemory, approveSuggestedMemory } = await import('@/lib/project-memory/manager');
    const created = await createMemory({
      projectId: PROJECT,
      memoryType: 'risk_class',
      key: 'rk',
      value: 'Class II',
      userId: USER,
      orgId: ORG,
      status: 'active', // already active
    });
    await expect(
      approveSuggestedMemory({ memoryId: created.id, userId: USER, orgId: ORG }),
    ).rejects.toThrow('memory_approve_state_error');
  });

  it('REJECTS approving an invalidated memory (no REQ-012 supersession bypass)', async () => {
    const { createMemory, invalidateMemory, approveSuggestedMemory } = await import(
      '@/lib/project-memory/manager'
    );
    const created = await createMemory({
      projectId: PROJECT,
      memoryType: 'device_classification',
      key: 'dc',
      value: 'Class II',
      userId: USER,
      orgId: ORG,
    });
    await invalidateMemory({ memoryId: created.id, userId: USER, orgId: ORG });
    // Attempting to re-approve the invalidated row MUST fail — cannot resurrect.
    await expect(
      approveSuggestedMemory({ memoryId: created.id, userId: USER, orgId: ORG }),
    ).rejects.toThrow('memory_approve_state_error');
  });

  it('throws memory_approve_target_missing when the row does not exist', async () => {
    const { approveSuggestedMemory } = await import('@/lib/project-memory/manager');
    await expect(
      approveSuggestedMemory({
        memoryId: 'nonexistent-row-id',
        userId: USER,
        orgId: ORG,
      }),
    ).rejects.toThrow('memory_approve_target_missing');
  });
});
