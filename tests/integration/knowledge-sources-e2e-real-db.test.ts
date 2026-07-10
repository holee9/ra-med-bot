// @MX:NOTE [AUTO] Real-DB E2E for knowledge_sources ingestion (#312 AC-1/AC-2, L-013).
// @MX:SPEC SPEC-REGULA-CORPUS-SEED-001 (AC-1, AC-2, AC-12; REQ-KB-002, 006, 009, 030, 031, 032)
// @MX:REASON [AUTO] L-013: mock-only ingestion hides gx10-embedding + pgvector-upsert +
//   approval-gate integration bugs. This runs the REAL ingestDocuments pipeline
//   (extract→classify→chunk→gx10 embed→source_sections upsert) against a live pgvector
//   DB + real gx10 Ollama, then verifies a pgvector cosine query returns a citation
//   AFTER source-governance approval (composeRetrievalGates semantics — pending_review
//   is excluded). Org-scoped seed + DELETE cleanup protects the shared test DB.
//
// Skip when no DATABASE_URL (local unit runs). gx10 failure → test errors (real infra).

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { corpusSyncRuns, knowledgeSources, sourceSections, sources } from '@/lib/db/schema';
import { embedChunks } from '@/lib/ingest/embed';
import { HAS_DATABASE_URL, getDb, seedCoreActors } from '../fixtures/database';

// Real-DB data, mock audit (fixtures/database.ts contract: writeAudit must be mocked).
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// Distinct IDs so cleanup is org-scoped (never touches shared corpus seed). Valid hex UUIDs.
const ORG_ID = '10000000-aaaa-4000-8000-a00000000001';
const USER_ID = '10000000-aaaa-4000-8000-a00000000101';
const KS_ID = '10000000-aaaa-4000-8000-a00000000201';

const skip = !HAS_DATABASE_URL;

describe.skipIf(skip)('knowledge_sources ingestion E2E (real DB + gx10) — #312 AC-1/AC-2', () => {
  let tmpDir: string;

  beforeAll(async () => {
    await seedCoreActors({
      orgId: ORG_ID,
      orgName: 'KB E2E Org',
      userId: USER_ID,
      userEmail: 'kb-e2e@example.test',
      userName: 'KB E2E',
      projectId: '10000000-aaaa-4000-8000-a00000000301',
      projectName: 'KB E2E Project',
    });
  });

  beforeEach(async () => {
    await orgScopedCleanup();
    tmpDir = await mkdtemp(join(tmpdir(), 'kb-e2e-'));
    await writeFile(
      join(tmpDir, 'fda-510k.md'),
      '# FDA 510(k) Submission\n\nThe 510(k) premarket notification requires a substantial equivalence comparison to a legally-marketed predicate device.\n',
    );
    await writeFile(
      join(tmpDir, 'eu-mdr.md'),
      '# EU MDR Article 61\n\nClinical evaluation in accordance with Annex XIV is required for all medical devices under EU Medical Device Regulation 2017/745.\n',
    );
  });

  afterAll(async () => {
    await orgScopedCleanup();
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  // Org-scoped DELETE cleanup (never TRUNCATE shared corpus tables).
  async function orgScopedCleanup(): Promise<void> {
    const db = await getDb();
    await db
      .delete(sourceSections)
      .where(
        sql`${sourceSections.sourceId} IN (SELECT id FROM sources WHERE organization_id = ${ORG_ID})`,
      );
    await db.delete(sources).where(eq(sources.organizationId, ORG_ID));
    await db.delete(corpusSyncRuns).where(eq(corpusSyncRuns.crawlerName, 'knowledge-source'));
    await db.delete(knowledgeSources).where(eq(knowledgeSources.organizationId, ORG_ID));
  }

  it('AC-1: ingestDocuments populates sources/source_sections with real gx10 embeddings + corpus_sync_runs (synced)', async () => {
    const db = await getDb();
    await db.insert(knowledgeSources).values({
      id: KS_ID,
      organizationId: ORG_ID,
      createdBy: USER_ID,
      gitUrl: 'https://github.com/example/md-process.git',
      branch: 'main',
      sourceHost: 'github.com',
      sourceOwner: 'example',
      sourceRepo: 'md-process',
    });

    const { ingestDocuments } = await import('@/lib/knowledge-sources/sync');
    const stats = await ingestDocuments(tmpDir, KS_ID, ORG_ID);

    expect(stats.filesProcessed).toBe(2);
    expect(stats.chunksAdded).toBeGreaterThan(0);

    // sources: 1 per file, pending_review (source-governance gate — never reaches retriever).
    const srcRows = await db.select().from(sources).where(eq(sources.organizationId, ORG_ID));
    expect(srcRows.length).toBe(2);
    expect(srcRows.every((s) => s.approvalStatus === 'pending_review')).toBe(true);

    // source_sections with non-null gx10 embeddings (the L-013 core — real embed, not mock null).
    // Scope to THIS org's sections (shared test DB has pre-existing seed sections).
    const secRows = await db
      .select({ emb: sourceSections.embedding })
      .from(sourceSections)
      .innerJoin(sources, eq(sources.id, sourceSections.sourceId))
      .where(eq(sources.organizationId, ORG_ID));
    expect(secRows.length).toBeGreaterThan(0);
    expect(secRows.every((s) => s.emb !== null)).toBe(true);

    // corpus_sync_runs: 1 row, synced.
    const runs = await db.select().from(corpusSyncRuns);
    expect(runs.length).toBe(1);
    expect(runs[0]?.status).toBe('synced');
  }, 60000);

  it('AC-2: after source-governance approval, pgvector cosine query returns a relevant citation', async () => {
    const db = await getDb();
    await db.insert(knowledgeSources).values({
      id: KS_ID,
      organizationId: ORG_ID,
      createdBy: USER_ID,
      gitUrl: 'https://github.com/example/md-process.git',
      branch: 'main',
      sourceHost: 'github.com',
      sourceOwner: 'example',
      sourceRepo: 'md-process',
    });
    const { ingestDocuments } = await import('@/lib/knowledge-sources/sync');
    await ingestDocuments(tmpDir, KS_ID, ORG_ID);

    // Approval gate: pending_review → approved (REQ-KB-009; composeRetrievalGates excludes non-approved).
    await db
      .update(sources)
      .set({ approvalStatus: 'approved' })
      .where(eq(sources.organizationId, ORG_ID));

    // Embed the query via the SAME gx10 pipeline the retriever uses.
    const [queryEmb] = await embedChunks(['What are the FDA 510(k) submission requirements?']);
    expect(queryEmb).not.toBeNull();
    const vecLit = `[${(queryEmb as number[]).join(',')}]`;

    // pgvector cosine similarity join (mirrors hybrid-search.ts:132), approved sources only.
    const result = await db.execute(sql`
      SELECT ss.heading, ss.text, 1.0 - (ss.embedding <=> ${vecLit}::vector) AS similarity
      FROM source_sections ss
      JOIN sources s ON s.id = ss.source_id
      WHERE s.approval_status = 'approved' AND s.organization_id = ${ORG_ID}
      ORDER BY ss.embedding <=> ${vecLit}::vector
      LIMIT 1`);
    const rows = result as unknown as Array<{
      heading: string | null;
      text: string;
      similarity: number;
    }>;
    expect(rows.length).toBe(1);
    // Nearest hit is the FDA 510(k) doc, not EU MDR (retrieval correctness).
    expect(rows[0]?.text).toMatch(/510\(k\)|predicate|substantial equivalence/i);
    expect(rows[0]?.similarity).toBeGreaterThan(0.2);
  }, 60000);
});
