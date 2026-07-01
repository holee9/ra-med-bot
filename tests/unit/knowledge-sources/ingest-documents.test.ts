// @MX:NOTE [AUTO] Unit tests for ingestDocuments — per-file pipeline, caps, supersession.
// @MX:SPEC Issue #307 D-2b (Knowledge Ingestion) AC-1..AC-7
//
// Strategy (mirrors tests/integration/knowledge-sources.test.ts):
//   1. Mock @/lib/db/client — in-memory store for knowledge_sources + sources +
//      source_sections + corpus_sync_runs, recording inserts/selects/updates so
//      pipeline behavior is verifiable without a real database.
//   2. Mock @/lib/ingest/embed — embedChunks returns a fixed 1536-dim vector per
//      input (avoids hitting the OpenAI API).
//   3. Mock @/lib/radar/delta-sync/orchestrator (resolveExistingChunkIds) and
//      @/lib/radar/delta-sync/ingest (applyOutdateOperations) — record calls.
//   4. Do NOT mock chunk/classifyDocument/extractText —
//      exercise the real registry with .md/.txt/.pdf fixtures.
//
// Asserts (design §5 AC-1..AC-7):
//   - AC-1: 3 markdown files → ≥1 source_section each with embedding.
//   - AC-2: pdf/docx dispatch extractText; sectionPath prefixed by relPath.
//   - AC-3: txt reads as UTF-8, does NOT call extractText.
//   - AC-4: chunk → embed call order enforced (SPEC-REGULA-PHI-REMOVAL-001: redact removed).
//   - AC-5: re-sync supersedes prior chunks (applyOutdateOperations called).
//   - AC-6: one corrupt file does not abort the repo.
//   - AC-7: MAX_FILES cap (500) enforced.

import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

// Index signature allows the in-memory rows to flow through the generic
// Record<string, unknown> predicates used by the db.update mock.
interface KnowledgeSourceRow {
  [key: string]: unknown;
  id: string;
  organizationId: string;
  branch: string;
  sourceHost: string | null;
  sourceOwner: string | null;
  sourceRepo: string | null;
  syncStatus: string;
}

interface SourceRow {
  [key: string]: unknown;
  id: string;
  organizationId: string;
  sourceHost: string | null;
  sourceOwner: string | null;
  sourceRepo: string | null;
  sourcePath: string | null;
  type: string;
  approvalStatus: string;
  ingestionRunId: string | null;
}

interface SourceSectionRow {
  [key: string]: unknown;
  id: string;
  sourceId: string;
  anchor: string | null;
  heading: string | null;
  text: string;
  embedding: unknown;
  sectionPath: string | null;
  ingestionRunId: string | null;
  chunkHash: string | null;
}

interface CorpusSyncRunRow {
  [key: string]: unknown;
  id: string;
  crawlerName: string;
  sourceUrl: string;
  status: string;
  chunksAdded: number | null;
  chunksOutdated: number | null;
}

const knowledgeSourcesStore: KnowledgeSourceRow[] = [];
const sourcesStore: SourceRow[] = [];
const sectionsStore: SourceSectionRow[] = [];
const runsStore: CorpusSyncRunRow[] = [];

// Spies on the mocked primitives.
let extractTextCalls: { mimeType: string }[] = [];
let embedCalls: string[][] = [];
let resolveExistingCalls: { sourceId: string; orgId: string }[] = [];
let applyOutdateCalls: { existingChunkIds: string[]; newIngestionRunId: string }[] = [];

// Control knobs.
let extractTextThrowFor: string[] = []; // mime types that should throw

// ---------------------------------------------------------------------------
// DB mock (in-memory).
// ---------------------------------------------------------------------------

const DRIZZLE_NAME = Symbol.for('drizzle:Name');
function tableName(table: unknown): string {
  if (table && typeof table === 'object') {
    const t = table as Record<symbol | string, unknown>;
    if (t[DRIZZLE_NAME] && typeof t[DRIZZLE_NAME] === 'string') return t[DRIZZLE_NAME] as string;
    for (const sym of Object.getOwnPropertySymbols(table)) {
      const v = t[sym as symbol];
      if (typeof v === 'string' && /name/i.test(String(sym))) return v;
    }
  }
  return 'unknown';
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// biome-ignore lint/suspicious/noExplicitAny: Drizzle select chain returns a thenable; rows typed loosely.
function buildSelectChain(boundTableRef: { t: string }, selected?: Record<string, unknown>): any {
  let pendingWhere: ((r: Record<string, unknown>) => boolean) | null = null;

  const compute = (): unknown[] => {
    let store: Record<string, unknown>[];
    if (boundTableRef.t === 'knowledge_sources')
      store = knowledgeSourcesStore as unknown as Record<string, unknown>[];
    else if (boundTableRef.t === 'sources')
      store = sourcesStore as unknown as Record<string, unknown>[];
    else if (boundTableRef.t === 'source_sections')
      store = sectionsStore as unknown as Record<string, unknown>[];
    else if (boundTableRef.t === 'corpus_sync_runs')
      store = runsStore as unknown as Record<string, unknown>[];
    else store = [];
    let rows = store.slice();
    if (pendingWhere) rows = rows.filter(pendingWhere as (r: unknown) => boolean);
    return selected ? rows.map((row) => projectSelected(row, selected)) : rows;
  };

  // biome-ignore lint/suspicious/noExplicitAny: recursive chain needs any self-type
  const lazyChain: any = {
    from: vi.fn((table: unknown) => {
      boundTableRef.t = tableName(table);
      return lazyChain;
    }),
    where: vi.fn((pred?: (r: Record<string, unknown>) => boolean) => {
      if (pred) pendingWhere = pred;
      return lazyChain;
    }),
    orderBy: vi.fn(() => lazyChain),
    limit: vi.fn(() => Promise.resolve(compute())),
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable for await semantics
    then: <U>(onfulfilled?: (v: unknown[]) => U | PromiseLike<U>) =>
      Promise.resolve(compute()).then(onfulfilled),
  };
  return lazyChain;
}

function projectSelected(
  row: Record<string, unknown>,
  cols: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cols)) out[key] = row[key];
  return out;
}

// biome-ignore lint/suspicious/noExplicitAny: query builder chain is deeply nested; loosely typed for test fidelity.
const dbMock: any = {
  select: vi.fn((cols?: Record<string, unknown>) => {
    const ref = { t: 'knowledge_sources' };
    return buildSelectChain(ref, cols);
  }),
  insert: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingValues: Record<string, unknown> | Record<string, unknown>[] = {};
    // biome-ignore lint/suspicious/noExplicitAny: recursive chain needs any self-type
    const chain: any = {
      values: vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => {
        pendingValues = values;
        return chain;
      }),
      returning: vi.fn(async (cols?: Record<string, unknown>) => {
        const arr = Array.isArray(pendingValues) ? pendingValues : [pendingValues];
        const created: Record<string, unknown>[] = [];
        for (const v of arr) {
          const id = (v.id as string) ?? randomUUID();
          if (tn === 'knowledge_sources') {
            const row: KnowledgeSourceRow = {
              id,
              organizationId: v.organizationId as string,
              branch: v.branch as string,
              sourceHost: (v.sourceHost as string | null) ?? null,
              sourceOwner: (v.sourceOwner as string | null) ?? null,
              sourceRepo: (v.sourceRepo as string | null) ?? null,
              syncStatus: (v.syncStatus as string) ?? 'idle',
            };
            knowledgeSourcesStore.push(row);
            created.push(row);
          } else if (tn === 'sources') {
            const row: SourceRow = {
              id,
              organizationId: v.organizationId as string,
              sourceHost: (v.sourceHost as string | null) ?? null,
              sourceOwner: (v.sourceOwner as string | null) ?? null,
              sourceRepo: (v.sourceRepo as string | null) ?? null,
              sourcePath: (v.sourcePath as string | null) ?? null,
              type: (v.type as string) ?? 'Internal',
              approvalStatus: (v.approvalStatus as string) ?? 'pending_review',
              ingestionRunId: (v.ingestionRunId as string | null) ?? null,
            };
            sourcesStore.push(row);
            created.push(row);
          } else if (tn === 'source_sections') {
            const row: SourceSectionRow = {
              id,
              sourceId: v.sourceId as string,
              anchor: (v.anchor as string | null) ?? null,
              heading: (v.heading as string | null) ?? null,
              text: v.text as string,
              embedding: v.embedding,
              sectionPath: (v.sectionPath as string | null) ?? null,
              ingestionRunId: (v.ingestionRunId as string | null) ?? null,
              chunkHash: (v.chunkHash as string | null) ?? null,
            };
            sectionsStore.push(row);
            created.push(row);
          } else if (tn === 'corpus_sync_runs') {
            const row: CorpusSyncRunRow = {
              id,
              crawlerName: v.crawlerName as string,
              sourceUrl: v.sourceUrl as string,
              status: (v.status as string) ?? 'pending',
              chunksAdded: null,
              chunksOutdated: null,
            };
            runsStore.push(row);
            created.push(row);
          }
        }
        // Returning: respect selected cols if provided (sources.id, corpusSyncRuns.id).
        if (cols && Object.keys(cols).length > 0) {
          return created.map((row) => projectSelected(row, cols as Record<string, unknown>));
        }
        return created;
      }),
    };
    return chain;
  }),
  update: vi.fn((table: unknown) => {
    const tn = tableName(table);
    let pendingSet: Record<string, unknown> = {};
    let pendingWhere: ((r: Record<string, unknown>) => boolean) | null = null;
    return {
      set: vi.fn((s: Record<string, unknown>) => {
        pendingSet = s;
        return {
          where: vi.fn((pred?: (r: Record<string, unknown>) => boolean) => {
            if (pred) pendingWhere = pred;
            // Apply the update against the in-memory store.
            const apply = (store: Record<string, unknown>[]) => {
              for (const row of store) {
                if (!pendingWhere || pendingWhere(row)) {
                  for (const [k, v] of Object.entries(pendingSet)) row[k] = v;
                }
              }
            };
            if (tn === 'knowledge_sources')
              apply(knowledgeSourcesStore as unknown as Record<string, unknown>[]);
            else if (tn === 'sources') apply(sourcesStore as unknown as Record<string, unknown>[]);
            else if (tn === 'source_sections')
              apply(sectionsStore as unknown as Record<string, unknown>[]);
            else if (tn === 'corpus_sync_runs')
              apply(runsStore as unknown as Record<string, unknown>[]);
            return Promise.resolve();
          }),
        };
      }),
    };
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
};

// eq override — predicate reads column .name (snake_case), maps to row camelCase.
async function getDrizzleMock() {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
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
  // and(): combine multiple predicates.
  const and = vi.fn(
    (...preds: ((r: Record<string, unknown>) => boolean)[]) =>
      (row: Record<string, unknown>) =>
        preds.every((p) => (p ? p(row) : true)),
  );
  return { ...actual, eq, and };
}

vi.mock('drizzle-orm', () => getDrizzleMock());
vi.mock('@/lib/db/client', () => ({
  db: dbMock,
  withTenantScope: vi.fn(
    async <T>(orgId: string, fn: (tx: typeof dbMock) => Promise<T>): Promise<T> => {
      void orgId;
      return fn(dbMock);
    },
  ),
}));

// Mock embed — fixed 1536-dim vector per input text (avoids OpenAI call).
vi.mock('@/lib/ingest/embed', () => ({
  embedChunks: vi.fn(async (texts: string[]): Promise<number[][]> => {
    embedCalls.push(texts);
    return texts.map(() => Array.from({ length: 1536 }, () => 0.1));
  }),
}));

// Mock extractText — only pdf/docx supported; txt/md never reach it.
vi.mock('@/lib/ingest/extract', () => ({
  extractText: vi.fn(async (buffer: Buffer, mimeType: string): Promise<string> => {
    extractTextCalls.push({ mimeType });
    if (extractTextThrowFor.includes(mimeType)) {
      throw new Error(`extract_failed: ${mimeType}`);
    }
    return buffer.toString('utf-8');
  }),
}));

// Mock resolveExistingChunkIds + applyOutdateOperations (delta-sync reuse).
vi.mock('@/lib/radar/delta-sync/orchestrator', () => ({
  resolveExistingChunkIds: vi.fn(async (sourceId: string, orgId: string): Promise<string[]> => {
    resolveExistingCalls.push({ sourceId, orgId });
    // Return sections previously inserted for this source (simulating a re-sync).
    return sectionsStore.filter((s) => s.sourceId === sourceId).map((s) => s.id);
  }),
}));
vi.mock('@/lib/radar/delta-sync/ingest', () => ({
  applyOutdateOperations: vi.fn(
    async (params: { orgId: string; existingChunkIds: string[]; newIngestionRunId: string }) => {
      applyOutdateCalls.push({
        existingChunkIds: params.existingChunkIds,
        newIngestionRunId: params.newIngestionRunId,
      });
      return { applied: params.existingChunkIds.length, results: [] };
    },
  ),
}));

// Mock audit (not asserted here, but the real writeAudit would need a DB).
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => undefined) }));

// Import AFTER mocks are registered.
const { ingestDocuments } = await import('@/lib/knowledge-sources/sync');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedKnowledgeSource(orgId = 'org-A', id = 'ks-1'): KnowledgeSourceRow {
  const row: KnowledgeSourceRow = {
    id,
    organizationId: orgId,
    branch: 'main',
    sourceHost: 'github.com',
    sourceOwner: 'acme',
    sourceRepo: 'sop-repo',
    syncStatus: 'synced',
  };
  knowledgeSourcesStore.push(row);
  return row;
}

async function makeRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `ks-ingest-${randomUUID().slice(0, 8)}-`));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    const parent = abs.slice(0, abs.lastIndexOf('/'));
    await mkdir(parent, { recursive: true });
    await writeFile(abs, content, 'utf-8');
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  knowledgeSourcesStore.length = 0;
  sourcesStore.length = 0;
  sectionsStore.length = 0;
  runsStore.length = 0;
  extractTextCalls = [];
  embedCalls = [];
  resolveExistingCalls = [];
  applyOutdateCalls = [];
  extractTextThrowFor = [];
  vi.clearAllMocks();
});

afterEach(async () => {
  // Vitest caches tmpdirs only in-process; OS reaps them. No-op here.
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ingestDocuments — per-file pipeline', () => {
  it('AC-1: ingests 3 markdown files → ≥3 source_sections with embeddings', async () => {
    const repo = await makeRepo({
      'a.md': '# SOP A\nRevision History\n1.0 init\n\n1. Body content A\n',
      'b.md': '# SOP B\nRevision History\n1.0 init\n\n1. Body content B\n',
      'c.md': '# SOP C\nRevision History\n1.0 init\n\n1. Body content C\n',
    });
    seedKnowledgeSource();

    const stats = await ingestDocuments(repo, 'ks-1', 'org-A');

    expect(stats.filesProcessed).toBe(3);
    expect(stats.chunksAdded).toBeGreaterThanOrEqual(3);
    expect(sectionsStore.length).toBeGreaterThanOrEqual(3);
    // Every section has a non-null embedding + links back to a sources row.
    for (const sec of sectionsStore) {
      expect(sec.embedding).toBeDefined();
      expect(sec.sourceId).toBeTruthy();
      const parent = sourcesStore.find((s) => s.id === sec.sourceId);
      expect(parent).toBeDefined();
      expect(parent?.organizationId).toBe('org-A');
    }
    // 3 distinct sources rows (one per file).
    expect(sourcesStore.length).toBe(3);
    // corpus_sync_runs row created + synced.
    expect(runsStore.length).toBe(1);
    expect(runsStore[0]?.status).toBe('synced');
    expect(runsStore[0]?.crawlerName).toBe('knowledge-source');
  });

  it('AC-2: pdf/docx dispatch extractText; sectionPath prefixed by relPath', async () => {
    // extractText mock reads the buffer as UTF-8 — so write text content as bytes.
    const pdfContent = 'fake-pdf-body-text content here';
    const docxContent = 'fake-docx-body-text content here';
    const repo = await makeRepo({
      'guide.pdf': pdfContent,
      'manual.docx': docxContent,
    });
    seedKnowledgeSource();

    await ingestDocuments(repo, 'ks-1', 'org-A');

    // extractText was called for BOTH pdf and docx (not skipped).
    const calledMimes = extractTextCalls.map((c) => c.mimeType);
    expect(calledMimes).toContain('application/pdf');
    expect(calledMimes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    // sectionPath on every inserted section is prefixed by the relPath.
    for (const sec of sectionsStore) {
      expect(sec.sectionPath).toMatch(/^(guide\.pdf|manual\.docx)#/);
    }
  });

  it('AC-3: txt reads as UTF-8, does NOT call extractText', async () => {
    const repo = await makeRepo({
      'notes.txt': 'plain text notes line one\n1. body item\n',
    });
    seedKnowledgeSource();

    await ingestDocuments(repo, 'ks-1', 'org-A');

    // extractText must NOT be called for text/plain.
    expect(extractTextCalls.map((c) => c.mimeType)).not.toContain('text/plain');
    // Still produced at least one section.
    expect(sectionsStore.length).toBeGreaterThanOrEqual(1);
  });

  it('AC-4: chunk → embed order enforced (embed receives chunked text)', async () => {
    const repo = await makeRepo({
      'sop.md': '# SOP\nRevision History\n1.0 init\n\n1. Body line one\n2. Body line two\n',
    });
    seedKnowledgeSource();

    await ingestDocuments(repo, 'ks-1', 'org-A');

    // embedChunks was called exactly once per file, with an array of chunk texts.
    expect(embedCalls.length).toBe(1);
    expect(embedCalls[0]?.length).toBeGreaterThanOrEqual(1);
    // Every embedded text corresponds to an inserted section text (pipeline integrity).
    const embeddedTexts = embedCalls[0] ?? [];
    for (const t of embeddedTexts) {
      expect(sectionsStore.some((s) => s.text === t)).toBe(true);
    }
  });

  it('AC-5: re-sync supersedes prior chunks (applyOutdateOperations called)', async () => {
    const repo = await makeRepo({
      'sop.md': '# SOP\nRevision History\n1.0 init\n\n1. Body content\n',
    });
    seedKnowledgeSource();

    // First sync — inserts sections.
    await ingestDocuments(repo, 'ks-1', 'org-A');
    const firstRunSections = sectionsStore.length;
    expect(firstRunSections).toBeGreaterThan(0);
    // On the first run, resolveExistingChunkIds returned [] (no prior sections),
    // so applyOutdateOperations should NOT have been called.
    expect(applyOutdateCalls.length).toBe(0);

    // Second sync — re-ingest the same repo. Now resolveExistingChunkIds returns
    // the previously-inserted section ids, and applyOutdateOperations must fire.
    await ingestDocuments(repo, 'ks-1', 'org-A');

    expect(applyOutdateCalls.length).toBe(1);
    expect(applyOutdateCalls[0]?.existingChunkIds.length).toBe(firstRunSections);
    // Two corpus_sync_runs rows (one per run).
    expect(runsStore.length).toBe(2);
  });

  it('AC-6: one corrupt file does NOT abort the repo (per-file isolation)', async () => {
    // Make extractText throw for PDF only — DOCX/TXT/MD must still succeed.
    extractTextThrowFor = ['application/pdf'];
    const repo = await makeRepo({
      'broken.pdf': 'not-a-real-pdf',
      'good.md': '# Good SOP\nRevision History\n1.0 init\n\n1. Body\n',
      'good.txt': 'plain notes\n1. body\n',
    });
    seedKnowledgeSource();

    const stats = await ingestDocuments(repo, 'ks-1', 'org-A');

    // 2 files processed (md + txt); 1 error recorded (pdf).
    expect(stats.filesProcessed).toBe(2);
    expect(stats.errors.length).toBe(1);
    expect(stats.errors[0]?.relPath).toBe('broken.pdf');
    // Run still succeeded (partial) — corpus_sync_runs status='synced'.
    expect(runsStore[0]?.status).toBe('synced');
    // Good files' sections are present.
    expect(sectionsStore.length).toBeGreaterThanOrEqual(2);
  });

  it('AC-7: MAX_FILES cap (500) enforced — excess files skipped', async () => {
    // Build a repo with 600 tiny files. scanRepo must cap at 500.
    const files: Record<string, string> = {};
    for (let i = 0; i < 600; i++) {
      files[`f${i}.md`] = `# File ${i}\nRevision History\n1.0 init\n\n1. Body ${i}\n`;
    }
    const repo = await makeRepo(files);
    seedKnowledgeSource();

    const stats = await ingestDocuments(repo, 'ks-1', 'org-A');

    // Cap is 500 — no more than 500 files processed.
    expect(stats.filesProcessed).toBeLessThanOrEqual(500);
    expect(stats.filesProcessed).toBe(500);
  });

  it('skips .git internals and unsupported binary extensions', async () => {
    const repo = await makeRepo({
      'sop.md': '# SOP\nRevision History\n1.0 init\n\n1. Body\n',
      '.git/config': 'should-be-skipped', // hidden + inside .git (double-guarded)
      'image.png': 'binary-content', // unsupported ext
      'binary.exe': 'MZ', // unsupported ext
    });
    seedKnowledgeSource();

    await ingestDocuments(repo, 'ks-1', 'org-A');

    // Only the .md was processed → 1 source row, ≥1 section.
    expect(sourcesStore.length).toBe(1);
    expect(sourcesStore[0]?.sourcePath).toBe('sop.md');
  });
});
