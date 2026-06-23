// @MX:NOTE [AUTO] H1+H2 regression — route-level IDOR + transactional audit.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-010, AC-06)
// @MX:TEST regression for:
//   H1: the IDOR double-gate (createEdge → getNode returns null for cross-org
//       toNodeId) must surface as a 404 at the HTTP layer. The gate itself is
//       NOT mocked — only the DB layer. Pre-fix: zero route-level IDOR tests
//       (L-006 anti-pattern that bit #35).
//   H2: edge create + audit commit atomically. A throw after the edge INSERT
//       must roll back BOTH the edge AND the audit row. Pre-fix: independent
//       autocommits → edge could persist without audit (21 CFR Part 11 violation).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'ra-lead',
    organizationId: '00000000-0000-0000-0000-AAAAAAAAAAAA',
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

// State that tests reconfigure per-case.
let getNodeResult: unknown = null; // null = cross-org/not-found, object = found
let throwAfterEdgeInsert = false;
const insertedEdges: unknown[] = [];
const insertedAudits: unknown[] = [];

function nameOf(table: unknown): string {
  const sym = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
  return typeof sym === 'string' ? sym : '?';
}

const dbStub = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => (getNodeResult === null ? [] : [getNodeResult]),
      }),
    }),
  }),
  insert: (table: unknown) => {
    const name = nameOf(table);
    return {
      // writeAudit does `await client.insert(table).values(row)` (no .returning),
      // so .values() must be awaitable. createEdge calls `.values(row).returning()`.
      // We return a Promise subclass with the chain methods attached.
      values: (row: unknown) => {
        // Record the insert immediately (for the non-.returning audit path).
        if (name === 'audit_logs') insertedAudits.push(row);
        const p = Promise.resolve(undefined) as Promise<unknown> & {
          returning: () => unknown[];
          onConflictDoNothing: () => undefined;
        };
        p.returning = () => {
          if (name === 'evidence_edges') {
            insertedEdges.push(row);
            if (throwAfterEdgeInsert) {
              throw new Error('SIMULATED_AUDIT_FAILURE');
            }
            return [{ id: 'edge-1', ...(row as object) }];
          }
          if (name === 'audit_logs') {
            // Already recorded above; dedupe.
            return [{ id: 'audit-1' }];
          }
          return [{}];
        };
        p.onConflictDoNothing = () => undefined;
        return p;
      },
    };
  },
  delete: () => ({ where: () => undefined }),
  transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const edgesBefore = insertedEdges.length;
    const auditsBefore = insertedAudits.length;
    try {
      return await fn(dbStub);
    } catch (err) {
      // Rollback: truncate inserts made during this transaction.
      insertedEdges.length = edgesBefore;
      insertedAudits.length = auditsBefore;
      throw err;
    }
  },
};

// vi.mock: hoisted, replaces modules before any import. The factory controls
// behavior via the mutable state above. This is the ONLY way to mock @/lib/db
// for a route handler that imports it at module-load time.
vi.mock('@/lib/db/client', () => ({ db: dbStub }));
vi.mock('@/lib/auth', () => ({ auth: async () => SESSION }));
vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: async () => true,
  isProjectMember: async () => true,
}));
vi.mock('@/lib/auth/permissions', () => ({
  PERMISSIONS: { 'traceability.manage': ['ra-lead'] },
  roleSatisfiesPermission: () => true,
}));
vi.mock('@/lib/traceability/stale-propagation', () => ({
  propagateStaleFromNode: vi.fn(),
  listStaleNodeIds: vi.fn(),
}));

beforeEach(() => {
  insertedEdges.length = 0;
  insertedAudits.length = 0;
  getNodeResult = null;
  throwAfterEdgeInsert = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('H1: edge-create IDOR returns 404 for cross-org toNodeId (route-level)', () => {
  it('returns 404 (not 403, not 500) when toNodeId belongs to another org', async () => {
    // getNodeResult stays null → getNode returns [] → createEdge throws EdgeIdorError.
    const { POST } = await import('@/app/api/traceability/edges/route');
    const req = new Request('http://localhost/api/traceability/edges', {
      method: 'POST',
      body: JSON.stringify({
        fromNodeId: '00000000-0000-0000-0000-000000000010',
        toNodeId: '00000000-0000-0000-0000-BBBBBBBBBBBB',
        relation: 'cites',
        action: 'create',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    // No edge inserted (the IDOR gate threw before the INSERT).
    expect(insertedEdges).toHaveLength(0);
  });

  it('returns 201 when both endpoints are same-org (happy path)', async () => {
    // getNode returns a valid same-org node for both from + to lookups.
    getNodeResult = {
      id: 'n1',
      orgId: SESSION.user.organizationId,
      nodeType: 'message',
      refTable: 'messages',
      refId: 'm1',
    };
    const { POST } = await import('@/app/api/traceability/edges/route');
    const req = new Request('http://localhost/api/traceability/edges', {
      method: 'POST',
      body: JSON.stringify({
        fromNodeId: '00000000-0000-0000-0000-000000000010',
        toNodeId: '00000000-0000-0000-0000-000000000020',
        relation: 'cites',
        action: 'create',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(201);
    expect(insertedEdges).toHaveLength(1);
    expect(insertedAudits).toHaveLength(1);
  });
});

describe('H2: edge create + audit are transactional (21 CFR Part 11)', () => {
  it('rolls back BOTH edge and audit when the audit insert fails mid-transaction', async () => {
    getNodeResult = {
      id: 'n1',
      orgId: SESSION.user.organizationId,
      nodeType: 'message',
      refTable: 'messages',
      refId: 'm1',
    };
    throwAfterEdgeInsert = true; // simulate transient failure after edge INSERT

    const { POST } = await import('@/app/api/traceability/edges/route');
    const req = new Request('http://localhost/api/traceability/edges', {
      method: 'POST',
      body: JSON.stringify({
        fromNodeId: '00000000-0000-0000-0000-000000000010',
        toNodeId: '00000000-0000-0000-0000-000000000020',
        relation: 'cites',
        action: 'create',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    // The transaction throws → withPermission's caller maps to 500.
    await expect(POST(req, {})).rejects.toThrow('SIMULATED_AUDIT_FAILURE');
    // H2 core assertion: NEITHER the edge NOR the audit row persists.
    // Pre-fix (independent autocommits): the edge would persist with zero audit.
    expect(insertedEdges).toHaveLength(0);
    expect(insertedAudits).toHaveLength(0);
  });
});
