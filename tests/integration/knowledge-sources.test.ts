// @MX:NOTE [AUTO] Runtime IDOR + audit tests for Knowledge Sources API.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)
//
// Strategy (mirrors tests/integration/capa-idor-runtime.test.ts):
//   1. Mock @/lib/kernel/auth/with-permission — bypass RBAC, inject a session per org.
//   2. Mock @/lib/kernel/db/client — in-memory store for knowledgeSources + auditLogs,
//      recording org-scoped select/insert/update/delete so CRUD + IDOR (cross-org)
//      + audit behavior is verifiable without a real database.
//   3. Mock @/lib/audit — record writeAudit calls.
//   4. Mock @/lib/knowledge-sources/sync — avoid real git clone in tests.
//   5. Call the REAL route handlers (POST/GET/DELETE/sync) with cross-org payloads.
//
// Asserts:
//   - POST creates source org-scoped + writes audit.
//   - POST rejects invalid git URL (400).
//   - GET lists org-scoped sources only.
//   - DELETE removes own-org source; 404 for non-existent.
//   - IDOR: cross-org delete is blocked (access helper throws org_mismatch → 403).
//   - POST /sync triggers sync on own-org source.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types — Session shape injected via withPermission mock.
// ---------------------------------------------------------------------------

interface MockSessionUser {
  id: string;
  role: string;
  organizationId: string;
  email?: string;
}
interface MockSession {
  user: MockSessionUser;
}

// Next.js 15 Route Handler context: params is a Promise.
interface RouteCtx {
  params: Promise<{ id: string }> | { id: string };
}

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

interface KnowledgeSourceRow {
  id: string;
  organizationId: string;
  createdBy: string;
  gitUrl: string;
  branch: string;
  sourceHost: string | null;
  sourceOwner: string | null;
  sourceRepo: string | null;
  authTokenEncrypted: string | null;
  syncStatus: string;
  createdAt: Date;
}

interface AuditLogRow {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metaJson: Record<string, unknown>;
  createdAt: Date;
}

const knowledgeSourcesStore: KnowledgeSourceRow[] = [];
const auditLogsStore: AuditLogRow[] = [];

// Recorded writeAudit calls (params form, before mapping to row shape).
interface AuditCall {
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  meta_json?: Record<string, unknown>;
}
const auditCalls: AuditCall[] = [];

// ---------------------------------------------------------------------------
// DB mock — in-memory knowledge_sources + audit_logs.
// Table identity is matched by a `name` property on the schema table object.
// Drizzle's query builder chain is deeply nested; this mock exposes only the
// callables the routes use: select().from().where().orderBy()/.limit(1),
// insert().values().returning(), delete().where().
// ---------------------------------------------------------------------------

// Drizzle stores the table name in a Symbol key (Symbol(drizzle:Name)), not on
// a plain .name property. Read it via the symbol; fall back to .name for
// hand-rolled fake tables in tests.
const DRIZZLE_NAME = Symbol.for('drizzle:Name');
function tableName(table: unknown): string {
  if (table && typeof table === 'object') {
    const t = table as Record<symbol | string, unknown>;
    if (t[DRIZZLE_NAME] && typeof t[DRIZZLE_NAME] === 'string') {
      return t[DRIZZLE_NAME] as string;
    }
    // Some Drizzle versions store OriginalName; check it as a fallback.
    for (const sym of Object.getOwnPropertySymbols(table)) {
      const v = t[sym as symbol];
      if (typeof v === 'string' && /name/i.test(String(sym))) return v;
    }
    const plain = (t as { name?: unknown }).name;
    if (typeof plain === 'string') return plain;
  }
  return 'unknown';
}

// Project only the selected columns (access helper uses select({organizationId: ...})).
function projectSelected(row: unknown, cols: Record<string, unknown>): unknown {
  if (!cols || typeof row !== 'object' || row === null) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cols)) {
    out[key] = (row as Record<string, unknown>)[key];
  }
  return out;
}

// Awaitable select chain (Promise subclass pattern from capa-idor-runtime).
// Builder methods mutate closure state; the chain resolves to filtered rows
// whether the caller uses .limit(1), awaits directly, or chains .orderBy().
// biome-ignore lint/suspicious/noExplicitAny: Drizzle select chain returns a thenable; rows typed loosely.
function buildSelectChain(selected?: Record<string, unknown>): any {
  let boundTable = 'knowledge_sources';
  let pendingWhere: ((r: KnowledgeSourceRow | AuditLogRow) => boolean) | null = null;

  const compute = (): unknown[] => {
    const store: unknown[] = boundTable === 'audit_logs' ? auditLogsStore : knowledgeSourcesStore;
    let rows = store.slice();
    if (pendingWhere) rows = rows.filter(pendingWhere as (r: unknown) => boolean);
    return selected ? rows.map((row) => projectSelected(row, selected)) : rows;
  };

  // Lazy thenable: defers resolution so builder calls (.from/.where/.orderBy)
  // executed AFTER select() but BEFORE await can mutate closure state. The chain
  // must resolve to compute() at await time, not at construction time.
  // biome-ignore lint/suspicious/noExplicitAny: recursive chain needs any self-type
  const lazyChain: any = {
    from: vi.fn((table: unknown) => {
      boundTable = tableName(table);
      return lazyChain;
    }),
    where: vi.fn((pred?: (r: KnowledgeSourceRow | AuditLogRow) => boolean) => {
      if (pred) pendingWhere = pred;
      return lazyChain;
    }),
    orderBy: vi.fn(() => lazyChain),
    limit: vi.fn(() => Promise.resolve(compute())),
    // Make the chain itself awaitable. Each access to .then re-evaluates compute()
    // so the latest builder state is used. This is an intentional thenable (the
    // Drizzle select chain is awaited directly after .from/.where/.orderBy).
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable for await semantics
    then: <U>(onfulfilled?: (v: unknown[]) => U | PromiseLike<U>) =>
      Promise.resolve(compute()).then(onfulfilled),
  };
  return lazyChain;
}

// biome-ignore lint/suspicious/noExplicitAny: query builder chain is deeply nested; loosely typed for test fidelity.
const dbMock: any = {
  select: vi.fn((cols?: Record<string, unknown>) => buildSelectChain(cols)),
  insert: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingValues: Record<string, unknown> | Record<string, unknown>[] = {};
    // biome-ignore lint/suspicious/noExplicitAny: recursive chain needs any self-type
    const chain: any = {
      values: vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => {
        pendingValues = values;
        return chain;
      }),
      returning: vi.fn(async () => {
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const created: KnowledgeSourceRow[] = [];
        for (const v of arr) {
          const row: KnowledgeSourceRow = {
            id: (v.id as string) ?? randomUUID(),
            organizationId: v.organizationId as string,
            createdBy: v.createdBy as string,
            gitUrl: v.gitUrl as string,
            branch: v.branch as string,
            sourceHost: (v.sourceHost as string | null) ?? null,
            sourceOwner: (v.sourceOwner as string | null) ?? null,
            sourceRepo: (v.sourceRepo as string | null) ?? null,
            authTokenEncrypted: (v.authTokenEncrypted as string | null) ?? null,
            syncStatus: (v.syncStatus as string) ?? 'idle',
            createdAt: new Date(),
          };
          if (tn === 'knowledge_sources') knowledgeSourcesStore.push(row);
          created.push(row);
        }
        return created;
      }),
    };
    return chain;
  }),
  delete: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingWhere: ((r: KnowledgeSourceRow) => boolean) | null = null;
    return {
      where: vi.fn((pred?: (r: KnowledgeSourceRow) => boolean) => {
        if (pred) pendingWhere = pred;
        // Apply the delete against the in-memory store immediately.
        if (tn === 'knowledge_sources' && pendingWhere) {
          const pred = pendingWhere as (r: unknown) => boolean;
          for (let i = knowledgeSourcesStore.length - 1; i >= 0; i -= 1) {
            const row = knowledgeSourcesStore[i];
            if (row && pred(row)) {
              knowledgeSourcesStore.splice(i, 1);
            }
          }
        } else if (tn === 'audit_logs') {
          auditLogsStore.length = 0;
        }
        return Promise.resolve({ success: true });
      }),
    };
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
};

// Mock drizzle-orm: re-export everything from the real module EXCEPT `eq`,
// which we override to return a callable predicate (Drizzle's real eq returns
// an opaque SQL object our in-memory store cannot interpret). The predicate
// reads the column's snake_case .name and maps it to the camelCase row key.
async function getDrizzleMock() {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  function snakeToCamel(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  }
  const eq = vi.fn(
    (column: unknown, value: unknown): ((row: Record<string, unknown>) => boolean) => {
      const colName =
        column && typeof column === 'object' && 'name' in column
          ? String((column as { name: unknown }).name)
          : 'unknown';
      const field = snakeToCamel(colName);
      return (row: Record<string, unknown>) => row[field] === value;
    },
  );
  return { ...actual, eq };
}
vi.mock('drizzle-orm', () => getDrizzleMock());

vi.mock('@/lib/kernel/db/client', () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Audit mock — record writeAudit calls into the in-memory audit store.
// ---------------------------------------------------------------------------

vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn(async (params: AuditCall) => {
    auditCalls.push(params);
    auditLogsStore.push({
      id: randomUUID(),
      actorId: params.actor_id,
      action: params.action,
      resourceType: params.resource_type,
      resourceId: params.resource_id ?? null,
      metaJson: params.meta_json ?? {},
      createdAt: new Date(),
    });
  }),
}));

// ---------------------------------------------------------------------------
// withPermission mock — inject the session we control. handler is 3-arg
// (req, ctx, session) per capa pattern.
// ---------------------------------------------------------------------------

let currentSession: MockSession = {
  user: { id: 'user-default', role: 'ra-lead', organizationId: 'org-default' },
};

vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: RouteCtx, session: MockSession) => Promise<Response>,
    ) =>
      async (req: Request, ctx: RouteCtx) =>
        handler(req, ctx, currentSession),
  ),
}));

// ---------------------------------------------------------------------------
// Sync mock — avoid real git clone.
// ---------------------------------------------------------------------------

vi.mock('@/lib/knowledge-sources/sync', () => ({
  syncKnowledgeSource: vi.fn(async () => undefined),
  ingestDocuments: vi.fn(async () => undefined),
}));

// Access helper runs against the in-memory store (it uses db.select().where().limit(1)).
// No separate mock needed.

// ---------------------------------------------------------------------------
// Import route handlers AFTER mocks are registered.
// ---------------------------------------------------------------------------

const { POST, GET } = await import('@/app/api/ra/knowledge-sources/route');
const { DELETE: DELETE_ID } = await import('@/app/api/ra/knowledge-sources/[id]/route');
const { POST: POST_SYNC } = await import('@/app/api/ra/knowledge-sources/[id]/sync/route');
const { syncKnowledgeSource } = await import('@/lib/knowledge-sources/sync');

// ---------------------------------------------------------------------------
// Session + seed helpers
// ---------------------------------------------------------------------------

function createMockSession(orgId: string): { session: MockSession; userId: string } {
  const userId = randomUUID();
  const session: MockSession = {
    user: { id: userId, role: 'ra-lead', organizationId: orgId },
  };
  currentSession = session;
  return { session, userId };
}

function seedSource(args: {
  orgId: string;
  userId: string;
  gitUrl?: string;
  syncStatus?: string;
}): KnowledgeSourceRow {
  const row: KnowledgeSourceRow = {
    id: randomUUID(),
    organizationId: args.orgId,
    createdBy: args.userId,
    gitUrl: args.gitUrl ?? 'https://github.com/test/repo.git',
    branch: 'main',
    sourceHost: 'github.com',
    sourceOwner: 'test',
    sourceRepo: 'repo',
    authTokenEncrypted: null,
    syncStatus: args.syncStatus ?? 'idle',
    createdAt: new Date(),
  };
  knowledgeSourcesStore.push(row);
  return row;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Knowledge Sources API', () => {
  beforeEach(() => {
    knowledgeSourcesStore.length = 0;
    auditLogsStore.length = 0;
    auditCalls.length = 0;
    vi.mocked(syncKnowledgeSource).mockClear();
    vi.mocked(syncKnowledgeSource).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/ra/knowledge-sources', () => {
    it('should create a knowledge source with valid git URL', async () => {
      const { session } = createMockSession('org-A');

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'https://github.com/owner/repo.git',
          branch: 'main',
          auth_token: null,
        }),
      });

      const response = await POST(request, {} as RouteCtx);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source).toBeDefined();
      expect(data.source.gitUrl).toBe('https://github.com/owner/repo.git');
      expect(data.source.branch).toBe('main');
      expect(data.source.organizationId).toBe(session.user.organizationId);

      // Verify the in-memory store now holds the created row.
      expect(knowledgeSourcesStore).toHaveLength(1);
      expect(knowledgeSourcesStore[0]?.organizationId).toBe('org-A');
    });

    it('should reject invalid git URL', async () => {
      createMockSession('org-A');

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'not-a-git-url',
          branch: 'main',
        }),
      });

      const response = await POST(request, {} as RouteCtx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_git_url');
      // No source should have been persisted.
      expect(knowledgeSourcesStore).toHaveLength(0);
    });

    it('should create audit log on create', async () => {
      const { userId } = createMockSession('org-A');

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      await POST(request, {} as RouteCtx);

      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0]?.action).toBe('knowledge_source.created');
      expect(auditCalls[0]?.actor_id).toBe(userId);
      expect(auditCalls[0]?.resource_type).toBe('knowledgeSource');
    });
  });

  describe('GET /api/ra/knowledge-sources', () => {
    it('should list knowledge sources for org (org-scoped)', async () => {
      const { userId } = createMockSession('org-A');

      // Seed one own-org source and one cross-org source.
      seedSource({ orgId: 'org-A', userId });
      seedSource({ orgId: 'org-B', userId: randomUUID() });

      const request = new Request('http://localhost/api/ra/knowledge-sources');
      const response = await GET(request, {} as RouteCtx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sources).toBeDefined();
      expect(data.sources).toHaveLength(1);
      expect(data.sources[0]?.organizationId).toBe('org-A');
    });
  });

  describe('DELETE /api/ra/knowledge-sources/[id]', () => {
    it('should delete a knowledge source in own org', async () => {
      const { userId } = createMockSession('org-A');
      const source = seedSource({ orgId: 'org-A', userId });

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}`, {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, {
        params: Promise.resolve({ id: source.id }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Row removed from in-memory store.
      expect(knowledgeSourcesStore.find((r) => r.id === source.id)).toBeUndefined();
    });

    it('should return 404 for non-existent source', async () => {
      createMockSession('org-A');

      const request = new Request('http://localhost/api/ra/knowledge-sources/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('not_found');
    });

    it('should block cross-org access (IDOR)', async () => {
      const { userId } = createMockSession('org-A');
      // Source belongs to a different org — access helper must throw org_mismatch.
      const source = seedSource({ orgId: 'org-B', userId });

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}`, {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, {
        params: Promise.resolve({ id: source.id }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('forbidden');
      // Cross-org source must NOT have been deleted.
      expect(knowledgeSourcesStore.find((r) => r.id === source.id)).toBeDefined();
    });
  });

  describe('POST /api/ra/knowledge-sources/[id]/sync', () => {
    it('should trigger sync for an own-org knowledge source', async () => {
      const { userId } = createMockSession('org-A');
      const source = seedSource({ orgId: 'org-A', userId, syncStatus: 'synced' });

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}/sync`, {
        method: 'POST',
      });

      const response = await POST_SYNC(request, {
        params: Promise.resolve({ id: source.id }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Sync completed');
      expect(syncKnowledgeSource).toHaveBeenCalledTimes(1);
    });

    it('should block cross-org sync (IDOR)', async () => {
      const { userId } = createMockSession('org-A');
      const source = seedSource({ orgId: 'org-B', userId });

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}/sync`, {
        method: 'POST',
      });

      const response = await POST_SYNC(request, {
        params: Promise.resolve({ id: source.id }),
      });

      expect(response.status).toBe(403);
      expect(syncKnowledgeSource).not.toHaveBeenCalled();
    });
  });
});
