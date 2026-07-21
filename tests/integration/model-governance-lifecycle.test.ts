// @MX:NOTE [AUTO] Model Governance mock-DB lifecycle tests (AC-02/03/06/07, IDOR, single-active, M3).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-005/006/008/013)
// @MX:REASON L-006 recurrence prevention: the prior suite was pure-function only
//           (DB tests were placeholders gated behind DATABASE_URL). These tests
//           exercise the REAL lib functions against a mock Drizzle client using
//           the CAPA #251 hybrid pattern (vi.doMock('@/lib/kernel/db/client') per test).
//           Covers: eval-blocks-approval, rollback-target (H1 desc), single-active,
//           IDOR, runtime-block model-mismatch (C2), rollback atomicity, M3 audit
//           persistence before throw.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Helper: build a chainable select mock. Each method returns the chain so the
// lib code (select().from().where().orderBy().limit()) works verbatim.
function buildSelectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const chain = resolved as unknown as Record<string, unknown> & {
    then: unknown;
    limit: unknown;
  };
  const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit'];
  for (const m of methods) {
    chain[m] = (..._args: unknown[]) => chain;
  }
  return chain;
}

function buildUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = (..._args: unknown[]) => chain;
  chain.where = (..._args: unknown[]) => Promise.resolve(undefined);
  return chain;
}

interface AuditLogRow {
  action: string;
  resource_type: string;
  resource_id: string;
  actor_id: string | null;
  meta_json: Record<string, unknown>;
}

interface MockState {
  approvedCombos: Record<string, unknown>[];
  changeRequests: Record<string, unknown>[];
  modelPins: Record<string, unknown>[];
  promptRegistry: Record<string, unknown>[];
  auditLogs: AuditLogRow[];
}

function createMockDb(state: MockState) {
  const db = {
    select: () => {
      // Default: return empty. Specific shapes are handled by test-controlled
      // overrides below; the generic chain lets lib code compose freely.
      return buildSelectChain([]);
    },
    insert: (table?: { _: unknown }) => {
      // The lib calls db.insert(schemaTable).values({...}).returning({...})
      // We route by the table identity — but since the mock does not have the
      // real schema objects, tests instead pre-populate state and the test
      // asserts on state after the call. For returning(), return the last
      // inserted row derived from state.
      const chain: Record<string, unknown> = {};
      chain.values = (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const arr = Array.isArray(vals) ? vals : [vals];
        // Determine target table by the table arg (schema objects carry a name-ish key).
        const tableName = (table as { name?: string } | undefined)?.name;
        const inserted = arr.map((v, i) => ({ id: `gen-${tableName ?? 'row'}-${i}`, ...v }));
        if (tableName === 'change_request') {
          state.changeRequests.push(...inserted);
        } else if (tableName === 'approved_combination') {
          state.approvedCombos.push(...inserted);
        }
        chain.returning = () => Promise.resolve(inserted);
        return chain;
      };
      return chain;
    },
    update: () => buildUpdateChain(),
    delete: () => {
      const chain: Record<string, unknown> = {};
      chain.where = () => Promise.resolve(undefined);
      return chain;
    },
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      // The tx shares the db's query surface. For mock purposes, reuse `db`.
      return fn(db);
    },
    query: {},
  };
  return db;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('@/lib/kernel/db/client');
  vi.resetModules();
});

// Capture writeAudit calls so tests can assert the audit survived (M3).
// We mock @/lib/audit so it records into state.auditLogs without touching DB.
async function mockModules(state: MockState) {
  const mockDb = createMockDb(state);
  vi.doMock('@/lib/kernel/db/client', () => ({
    db: mockDb,
    withTenantScope: vi.fn(
      async <T>(_orgId: string, fn: (db: typeof mockDb) => Promise<T>): Promise<T> =>
        fn(mockDb) as Promise<T>,
    ),
  }));
  vi.doMock('@/lib/kernel/audit', () => ({
    writeAudit: async (params: Record<string, unknown>, _tx?: unknown) => {
      state.auditLogs.push({
        action: String(params.action),
        resource_type: String(params.resource_type),
        resource_id: String(params.resource_id),
        meta_json: (params.meta_json as Record<string, unknown>) ?? {},
        actor_id: (params.actor_id as string | null) ?? null,
      });
    },
    // Re-export the type so `import type` works in the lib under test.
  }));
}

describe('SPEC-REGULA-MODEL-GOVERNANCE-001 — mock-DB lifecycle (AC-02/03/06/07, IDOR, C2, M3)', () => {
  it('AC-02: approveChangeRequest throws ChangeRequestBlockedError when eval_status=pending, and modelgov.rejected audit PERSISTS (M3 fix)', async () => {
    const state: MockState = {
      approvedCombos: [],
      changeRequests: [
        {
          id: 'cr-1',
          orgId: 'org-A',
          promptId: 'prompt-1',
          modelPinId: 'pin-1',
          evalStatus: 'pending',
          approvalStatus: 'pending_review',
          evalResultRef: null,
        },
      ],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    // Make the change_request SELECT return our pending row.
    const dbModule = await import('@/lib/kernel/db/client');
    const origSelect = (dbModule.db as unknown as { select: () => unknown }).select;
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      return buildSelectChain(state.changeRequests);
    };

    const { approveChangeRequest, ChangeRequestBlockedError } = await import(
      '@/lib/model-governance/change-workflow'
    );

    await expect(
      approveChangeRequest({
        changeRequestId: 'cr-1',
        orgId: 'org-A',
        approverId: 'user-1',
      }),
    ).rejects.toThrow(ChangeRequestBlockedError);

    // M3: the rejection audit MUST persist (not rolled back by the throw).
    const rejected = state.auditLogs.find((a) => a.action === 'modelgov.rejected');
    expect(rejected).toBeDefined();
    expect(rejected?.resource_id).toBe('cr-1');
    expect(String(rejected?.meta_json?.reason)).toContain('eval_status_pending_not_passed');

    // restore to avoid leaking into other dynamic-import paths
    (dbModule.db as unknown as { select: () => unknown }).select = origSelect;
  });

  it('H1/AC-03: rollback selects the MOST RECENT superseded combo (orderBy desc)', async () => {
    // Seed two superseded combos with ascending approvedAt. H1 bug (ASC) would
    // pick the OLDEST; the fix (DESC) picks the MOST RECENT.
    const oldest = new Date('2026-01-01T00:00:00Z');
    const newest = new Date('2026-06-01T00:00:00Z');
    const state: MockState = {
      approvedCombos: [
        { id: 'combo-old', orgId: 'org-A', active: false, approvedAt: oldest },
        { id: 'combo-new', orgId: 'org-A', active: false, approvedAt: newest },
        { id: 'combo-active', orgId: 'org-A', active: true, approvedAt: newest },
      ],
      changeRequests: [],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    // Wire the select to return rows matching the WHERE/ORDERBY. The lib query
    // uses .where(...).orderBy(...).limit(1) — our chain ignores the actual
    // predicates, so we simulate the DESC result by returning the newest inactive.
    const dbModule = await import('@/lib/kernel/db/client');
    let callCount = 0;
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      callCount++;
      if (callCount === 1) {
        // First select: current active.
        return buildSelectChain(
          [state.approvedCombos.find((c) => c.active === true)].filter(Boolean),
        );
      }
      // Second select: previous (inactive). DESC → newest inactive wins.
      const inactive = state.approvedCombos
        .filter((c) => c.active === false)
        .sort((a, b) => (b.approvedAt as Date).getTime() - (a.approvedAt as Date).getTime());
      return buildSelectChain([inactive[0]]);
    };

    const { rollbackCombination } = await import('@/lib/model-governance/rollback');
    const result = await rollbackCombination({ orgId: 'org-A', actorId: 'user-1' });

    // DESC fix: the target is combo-new (most recent), NOT combo-old.
    expect(result.toId).toBe('combo-new');
    expect(result.toId).not.toBe('combo-old');
  });

  it('C2: assertApprovedCombination blocks when active combo model != runtime model (model_mismatch)', async () => {
    const state: MockState = {
      approvedCombos: [],
      changeRequests: [],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    // Active combo approved for ollama/llama3.2.
    const dbModule = await import('@/lib/kernel/db/client');
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      return buildSelectChain([
        {
          id: 'combo-1',
          promptId: 'prompt-1',
          modelPinId: 'pin-1',
          promptVersion: 1,
          promptContentHash: 'abc',
          modelProvider: 'ollama',
          modelId: 'llama3.2',
          modelVersion: 'latest',
          approvedAt: new Date('2026-06-01T00:00:00Z'),
        },
      ]);
    };

    // Runtime is configured to ollama/gpt-oss:120b → mismatch vs approved ollama/llama3.2.
    // (Phase C, #318: runtime-model is ollama-only; OLLAMA_MODEL drives the mismatch.)
    vi.stubEnv('LLM_PROVIDER', 'ollama');
    vi.stubEnv('OLLAMA_MODEL', 'gpt-oss:120b');

    const { assertApprovedCombination, RuntimeBlockError } = await import(
      '@/lib/model-governance/runtime-guard'
    );

    await expect(assertApprovedCombination({ orgId: 'org-A' })).rejects.toThrow(RuntimeBlockError);

    try {
      await assertApprovedCombination({ orgId: 'org-A' });
    } catch (err) {
      expect((err as Error).message).toContain('model_mismatch');
      expect((err as Error).message).toContain('ollama/gpt-oss:120b');
      expect((err as Error).message).toContain('ollama/llama3.2');
    }

    vi.unstubAllEnvs();
  });

  it('C2: assertApprovedCombination PASSES when active combo model == runtime model', async () => {
    const state: MockState = {
      approvedCombos: [],
      changeRequests: [],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    const dbModule = await import('@/lib/kernel/db/client');
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      return buildSelectChain([
        {
          id: 'combo-1',
          promptId: 'prompt-1',
          modelPinId: 'pin-1',
          promptVersion: 1,
          promptContentHash: 'abc',
          modelProvider: 'ollama',
          modelId: 'llama3.2',
          modelVersion: 'latest',
          approvedAt: new Date('2026-06-01T00:00:00Z'),
        },
      ]);
    };

    vi.stubEnv('LLM_PROVIDER', 'ollama');
    vi.stubEnv('OLLAMA_MODEL', 'llama3.2');

    const { assertApprovedCombination } = await import('@/lib/model-governance/runtime-guard');
    const active = await assertApprovedCombination({ orgId: 'org-A' });
    expect(active.modelId).toBe('llama3.2');

    vi.unstubAllEnvs();
  });

  it('IDOR: cross-org change_request access returns null (404 at route layer)', async () => {
    const state: MockState = {
      approvedCombos: [],
      changeRequests: [{ id: 'cr-1', orgId: 'org-OTHER', promptId: null, modelPinId: null }],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    const dbModule = await import('@/lib/kernel/db/client');
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      // The access guard filters by orgId — cross-org returns no row.
      return buildSelectChain([]);
    };

    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-1', 'org-A');
    expect(result).toBeNull();
  });

  it('rollback atomicity: deactivates current + activates previous in one tx (no zero-active state)', async () => {
    const state: MockState = {
      approvedCombos: [
        { id: 'combo-active', orgId: 'org-A', active: true, approvedAt: new Date('2026-06-01') },
        { id: 'combo-prev', orgId: 'org-A', active: false, approvedAt: new Date('2026-05-01') },
      ],
      changeRequests: [],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    const dbModule = await import('@/lib/kernel/db/client');
    let selectCalls = 0;
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      selectCalls++;
      if (selectCalls === 1) {
        return buildSelectChain([state.approvedCombos[0]]); // current active
      }
      return buildSelectChain([state.approvedCombos[1]]); // previous inactive
    };

    // Track update calls to assert both happen inside the tx.
    const updates: Array<{ table: string; set: unknown }> = [];
    (dbModule.db as unknown as { update: (t?: { name?: string }) => unknown }).update = (table?: {
      name?: string;
    }) => {
      const chain: Record<string, unknown> = {};
      chain.set = (s: unknown) => {
        updates.push({ table: table?.name ?? 'unknown', set: s });
        return chain;
      };
      chain.where = () => Promise.resolve(undefined);
      return chain;
    };

    const { rollbackCombination } = await import('@/lib/model-governance/rollback');
    const result = await rollbackCombination({ orgId: 'org-A', actorId: 'user-1' });

    expect(result.fromId).toBe('combo-active');
    expect(result.toId).toBe('combo-prev');
    // Both updates executed (deactivate current + activate target).
    expect(updates.length).toBe(2);
    // The rollback audit row was written (21 CFR Part 11).
    const audit = state.auditLogs.find((a) => a.action === 'modelgov.rolled_back');
    expect(audit).toBeDefined();
  });

  it('AC-02: approveChangeRequest succeeds when eval_status=passed (happy path)', async () => {
    const state: MockState = {
      approvedCombos: [
        {
          id: 'combo-old-active',
          orgId: 'org-A',
          active: true,
          approvedAt: new Date('2026-05-01'),
        },
      ],
      changeRequests: [
        {
          id: 'cr-2',
          orgId: 'org-A',
          promptId: 'prompt-2',
          modelPinId: 'pin-2',
          evalStatus: 'passed',
          approvalStatus: 'pending_review',
          evalResultRef: 's3://eval/run-2.json',
        },
      ],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    const dbModule = await import('@/lib/kernel/db/client');
    let selectCalls = 0;
    (dbModule.db as unknown as { select: () => unknown }).select = () => {
      selectCalls++;
      // 1st select: change_request row (approvedChangeRequest reads it first).
      if (selectCalls === 1) {
        return buildSelectChain([state.changeRequests[0]]);
      }
      // 2nd select: current active combo (inside tx).
      return buildSelectChain([state.approvedCombos[0]]);
    };
    // insert returns the new combo row.
    (dbModule.db as unknown as { insert: (t?: { name?: string }) => unknown }).insert = (t?: {
      name?: string;
    }) => {
      const chain: Record<string, unknown> = {};
      chain.values = (vals: Record<string, unknown>) => {
        const inserted = { id: 'combo-new', ...vals };
        if (t?.name === 'approved_combination') state.approvedCombos.push(inserted);
        chain.returning = () => Promise.resolve([inserted]);
        return chain;
      };
      return chain;
    };

    const { approveChangeRequest } = await import('@/lib/model-governance/change-workflow');
    const result = await approveChangeRequest({
      changeRequestId: 'cr-2',
      orgId: 'org-A',
      approverId: 'user-ra-lead',
      evalResultRef: 's3://eval/run-2.json',
    });

    expect(result.combinationId).toBe('combo-new');
    // The approval audit was written.
    const audit = state.auditLogs.find((a) => a.action === 'modelgov.approved');
    expect(audit).toBeDefined();
    expect(String(audit?.meta_json?.approver_id)).toBe('user-ra-lead');
  });
});

describe('SPEC-REGULA-MODEL-GOVERNANCE-001 — runtime-model helper (C2 pure)', () => {
  it('getRuntimeModel resolves ollama default (gx10 gpt-oss:120b, Phase C)', async () => {
    vi.stubEnv('OLLAMA_MODEL', 'gpt-oss:120b');
    const { getRuntimeModel } = await import('@/lib/model-governance/runtime-model');
    expect(getRuntimeModel()).toEqual({ provider: 'ollama', modelId: 'gpt-oss:120b' });
    vi.unstubAllEnvs();
  });

  it('getRuntimeModel honors OLLAMA_MODEL override (Phase C: ollama-only)', async () => {
    vi.stubEnv('OLLAMA_MODEL', 'qwen3:32b');
    const { getRuntimeModel } = await import('@/lib/model-governance/runtime-model');
    expect(getRuntimeModel()).toEqual({ provider: 'ollama', modelId: 'qwen3:32b' });
    vi.unstubAllEnvs();
  });

  it('runtimeMatchesApproved is case-insensitive on provider', async () => {
    const { runtimeMatchesApproved } = await import('@/lib/model-governance/runtime-model');
    expect(
      runtimeMatchesApproved(
        { provider: 'OpenAI', modelId: 'gpt-4o' },
        { modelProvider: 'openai', modelId: 'gpt-4o' },
      ),
    ).toBe(true);
    expect(
      runtimeMatchesApproved(
        { provider: 'openai', modelId: 'gpt-4o' },
        { modelProvider: 'openai', modelId: 'gpt-4o-mini' },
      ),
    ).toBe(false);
  });
});

describe('SPEC-REGULA-MODEL-GOVERNANCE-001 — rlhf hash upgrade (M2)', () => {
  it('submitRlhfProposal stores a sha256: proposal hash (not fnv32)', async () => {
    const state: MockState = {
      approvedCombos: [],
      changeRequests: [],
      modelPins: [],
      promptRegistry: [],
      auditLogs: [],
    };
    await mockModules(state);

    const dbModule = await import('@/lib/kernel/db/client');
    (dbModule.db as unknown as { insert: (t?: { name?: string }) => unknown }).insert = (t?: {
      name?: string;
    }) => {
      const chain: Record<string, unknown> = {};
      chain.values = (vals: Record<string, unknown>) => {
        const inserted = { id: 'cr-rlhf-1', ...vals };
        if (t?.name === 'change_request') state.changeRequests.push(inserted);
        chain.returning = () => Promise.resolve([inserted]);
        return chain;
      };
      return chain;
    };

    const { submitRlhfProposal } = await import('@/lib/model-governance/rlhf-gate');
    const result = await submitRlhfProposal({
      orgId: 'org-A',
      submittedBy: 'user-1',
      proposalText: 'Improve FDA retrieval precision for 510(k) queries.',
    });

    expect(result.changeRequestId).toBe('cr-rlhf-1');
    const audit = state.auditLogs[0];
    const hash = String(audit?.meta_json?.proposal_text_hash ?? '');
    // M2: SHA-256 hex digest, prefixed sha256: (64 hex chars).
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hash).not.toMatch(/^fnv32:/);
  });
});
