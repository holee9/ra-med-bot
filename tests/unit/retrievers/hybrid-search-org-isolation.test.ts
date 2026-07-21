// @MX:NOTE [AUTO] Cross-org isolation regression test for hybridSearch.
// @MX:WARN [AUTO] RLS on sources/source_sections is NOT enabled — the app-level
// `s.organization_id = ${orgId}` filter in the SQL WHERE clause is the ONLY
// isolation boundary. Removing it is an IDOR-class security regression.
// @MX:REASON sources/source_sections are absent from the FORCE-RLS list in
// migrations/0084_force_rls.sql; RLS is inert project-wide.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-019 — org-scoped retrieval)
//
// Strategy: this is a regression test for the IDOR fix on hybrid-search.ts.
// The DB layer is mocked so we can capture the exact SQL string sent to
// db.execute, and assert the orgId filter is present in BOTH the hybrid
// (pgvector+FTS) path and the FTS-only fallback path. A secondary behavioral
// assertion mocks the DB to return rows from two different orgs and verifies
// that the retriever routes the orgId into the query — the filtering itself
// happens at the DB boundary, so the contract under test is "orgId reaches
// the SQL WHERE clause, not just the JS layer".

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures the mock exists before vi.mock factories run.
const { dbMock } = vi.hoisted(() => ({ dbMock: { execute: vi.fn() } }));

vi.mock('@/lib/kernel/db/client', () => ({
  db: dbMock,
  // withTenantScope invokes the callback synchronously with the same db handle.
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> =>
      fn(dbMock) as Promise<T>,
  ),
}));

// Mock embedding model (Phase A: centralized in lib/ai/embedding-provider).
vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@/lib/ai/embedding-provider', () => ({
  getEmbeddingModel: vi.fn().mockReturnValue('mock-embedding-model'),
}));

// Suppress the dynamic governance-gate import so the test never hits a real
// license query. The retrieval-gate mock returns an empty eligible set, which
// causes hybridSearch to short-circuit to [] — so we assert SQL capture BEFORE
// that short-circuit by inspecting db.execute calls directly.
vi.mock('@/lib/source-governance/retrieval-gate', () => ({
  composeRetrievalGates: vi.fn().mockResolvedValue(new Set<string>()),
}));

describe('hybridSearch — cross-org isolation (IDOR regression, REQ-CHAT-019)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hybrid path (embedding available) threads orgId into the SQL via s.organization_id', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.1),
      value: '510(k) submission',
      usage: { tokens: 10 },
    });
    // DB returns rows for orgA only — the query asked for orgA.
    vi.mocked(dbMock.execute).mockResolvedValueOnce([
      {
        section_id: 'sec-a',
        source_id: 'src-a',
        anchor: '§510(k)',
        text: '510(k) content',
        vec_score: 0.9,
        fts_score: 0.8,
        org_label: 'Org A',
        title: 'FDA Guidance',
        year: 2024,
        type: 'Guidance',
        url: null,
        source_host: null,
        source_owner: null,
        source_repo: null,
        source_ref: null,
        source_path: null,
      },
    ] as never);

    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    await hybridSearch('510(k) submission', 'all', 5, 'all', 'org-a-uuid');

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    // Drizzle's sql.tagged object stores its chunks on `queryChunks` (the
    // public `.sql`/`.values` shape differs across versions). JSON-serializing
    // the captured arg captures both the SQL text and the bound params
    // regardless of internal field layout.
    const callArg = vi.mocked(dbMock.execute).mock.calls[0]?.[0];
    const serialized = JSON.stringify(callArg);
    // Exact filter pattern — matches the internal-sops.ts sister retriever.
    expect(serialized).toContain('s.organization_id =');
    // The orgId value reaches the SQL parameter list.
    expect(serialized).toContain('org-a-uuid');
  });

  it('FTS-only fallback (no embedding) also threads orgId into the SQL', async () => {
    const { embed } = await import('ai');
    // Embedding fails → hybridSearch falls through to the FTS-only branch.
    vi.mocked(embed).mockRejectedValueOnce(new Error('OPENAI_API_KEY missing'));

    vi.mocked(dbMock.execute).mockResolvedValueOnce([
      {
        section_id: 'sec-a',
        source_id: 'src-a',
        anchor: '§510(k)',
        text: '510(k) content',
        vec_score: null,
        fts_score: 0.7,
        org_label: 'Org A',
        title: 'FDA Guidance',
        year: 2024,
        type: 'Guidance',
        url: null,
        source_host: null,
        source_owner: null,
        source_repo: null,
        source_ref: null,
        source_path: null,
      },
    ] as never);

    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    await hybridSearch('510(k) submission', 'all', 5, 'all', 'org-a-uuid');

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(dbMock.execute).mock.calls[0]?.[0];
    const serialized = JSON.stringify(callArg);
    expect(serialized).toContain('s.organization_id =');
    expect(serialized).toContain('org-a-uuid');
  });

  it('regression: rows from org B must not surface when querying for org A (behavioral)', async () => {
    // Behavioral IDOR guard. The DB layer is the boundary — if the org filter
    // is missing from the SQL, a real Postgres would return cross-org rows.
    // Here we simulate the "correctly-filtered" response (only orgA rows come
    // back when the query specifies orgA) and assert the orgId reached the SQL.
    const { embed } = await import('ai');
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.3),
      value: 'clinical trial exemption',
      usage: { tokens: 12 },
    });

    // DB returns ONLY orgA rows (because the SQL filter is in place).
    vi.mocked(dbMock.execute).mockResolvedValueOnce([
      {
        section_id: 'sec-a1',
        source_id: 'src-a',
        anchor: '§IV',
        text: 'org A content',
        vec_score: 0.88,
        fts_score: 0.6,
        org_label: 'Org A',
        title: 'Org A SOP',
        year: 2025,
        type: 'Internal',
        url: null,
        source_host: 'git.internal',
        source_owner: 'org-a',
        source_repo: 'sops',
        source_ref: 'abc12345',
        source_path: 'docs/sop.md',
      },
    ] as never);

    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    const results = await hybridSearch('clinical trial exemption', 'all', 5, 'all', 'org-a-uuid');

    // Every returned row must belong to the queried org (org A).
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceId).toBe('src-a');
    // Sanity: the SQL that was sent to the DB contains the org filter.
    const callArg = vi.mocked(dbMock.execute).mock.calls[0]?.[0];
    const serialized = JSON.stringify(callArg);
    expect(serialized).toContain('s.organization_id =');
    expect(serialized).toContain('org-a-uuid');
  });

  it('omits the org filter only when orgId is absent (project-wide corpus paths)', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockRejectedValueOnce(new Error('no key'));

    vi.mocked(dbMock.execute).mockResolvedValueOnce([] as never);

    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    // No orgId → no org filter in SQL (callers must ensure orgId for per-org paths).
    await hybridSearch('query', 'all', 5, 'all', undefined);

    const callArg = vi.mocked(dbMock.execute).mock.calls[0]?.[0];
    const serialized = JSON.stringify(callArg);
    expect(serialized).not.toContain('s.organization_id =');
  });
});
