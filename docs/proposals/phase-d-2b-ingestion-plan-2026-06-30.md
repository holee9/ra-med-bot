# Phase D-2b — `ingestDocuments` Implementation Plan

| Field | Value |
|---|---|
| Branch | `feat/d-2b-knowledge-ingestion` |
| Base | `main` @ `a514c88` |
| Issue | #307 Phase D-2b (stub TODO in `lib/knowledge-sources/sync.ts:180`) |
| Date | 2026-06-30 |
| Status | Design — awaiting approval |
| Governing SPECs | [`SPEC-REGULA-DOCINGEST-001`](../../.moai/specs/SPEC-REGULA-DOCINGEST-001/spec.md) (pipeline primitives), [`SPEC-REGULA-DELTA-SYNC-001`](../../.moai/specs/SPEC-REGULA-DELTA-SYNC-001/spec.md) (supersession), [`SPEC-REGULA-TRACEABILITY-001`](../../.moai/specs/SPEC-REGULA-TRACEABILITY-001/spec.md) (Part 11 audit) |
| Formal SPEC for D-2b | **None exists.** Recommend this design doc as the implementation contract (Issue #307 sub-task). A retrospective SPEC may be filed post-implementation. |

---

## 1. Goal & Non-Goals

### Goal

Implement `ingestDocuments(repoPath, sourceId, orgId)` in `lib/knowledge-sources/sync.ts`
so that a cloned knowledge-source repository is parsed, PII-redacted, chunked,
embedded, and upserted into `sources` + `source_sections` (pgvector), making the
site RAG retriever (`lib/ai/retrievers/internal-docs.ts`) return knowledge-source
content for organization-scoped queries.

The implementation MUST reuse the existing DOCINGEST pipeline primitives
(extract → redact → chunk → embed → upsert) and the delta-sync supersession
pattern (`applyOutdateOperations`). **No new chunker, embedder, or redactor
families are created.**

### Non-Goals (Scope Discipline)

| Out of scope | Owner |
|---|---|
| Settings UI for knowledge sources | Separate Phase D-3 |
| Public-repo E2E (real GitHub clone) | Separate validation PR |
| Re-tuning chunk sizes or embedding model | `SPEC-REGULA-DOCINGEST-001` owns these |
| Replacing the DOCINGEST upload-path stub `insertChunks` | Tracked separately — see §4.3 |
| Modifying `cloneRepo` RCE/SSRF defenses | **Preserved verbatim** — `lib/knowledge-sources/sync.ts:125-164` |
| Adding new `sources.type` enum values | Schema frozen |
| Vectorize (CF) upsert | Out of scope; pgvector is the retrieval target. Vectorize integration follows the delta-sync `buildVectorizeUpsertPayload` pattern as a follow-up. |

---

## 2. Reuse Map

For each pipeline stage, the exact `lib/ingest` / `lib/radar/delta-sync` function
to call. All functions are composable (pure or single-purpose) and require **no
adaptation** unless flagged.

| Stage | Function (file) | Signature | Returns | Adaptation needed? |
|---|---|---|---|---|
| **Scan repo** | (new) `scanRepoFiles(repoPath)` | `(repoPath: string) => Promise<ScannedFile[]>` | List of `{absPath, relPath, mimeType, size}` | **NEW** — but trivial: `fs.walk` + ext→MIME map. ~40 LOC. No lib change. |
| **Extract text** | `extractText(buffer, mimeType)` (`lib/ingest/extract/index.ts:30`) | `(buffer: Buffer, mimeType: string) => Promise<string>` | Plain text; throws `ExtractError` on unsupported | **GAP**: supports PDF/DOCX/XLSX/ZIP only. TXT/MD fall through to `ExtractError`. **Mitigation**: in `ingestDocuments`, read `.txt/.md` as UTF-8 directly and skip `extractText` for those extensions. No lib change needed. |
| **Classify** | `classifyDocument({filename, firstPageText})` (`lib/ingest/doc-classifier.ts:38`) | `(input: ClassifyInput) => ClassifyResult` | `{suggestedClass, confidence}` | None. Use `suggestedClass` if `confidence >= 0.6`, else fallback to `DocClass.internal_sop`. |
| **PII redact** | `redactPiiForIngest(text, docClass)` (`lib/ingest/pii/redact.ts:38`) | `(text: string, docClass: DocClass, options?) => Promise<RedactionResult>` | `{text, layersRun, redactionCount, ...}` | None. Use `.text`. The `saveMap` option is **omitted** for knowledge-sources (no `documentId` in the repo path; 21 CFR Part 11 reversibility for repo-ingested text is deferred — see §7 Risk 3). |
| **Chunk** | `chunk(docClass, text, metadata)` (`lib/ingest/chunkers/index.ts:32`) | `(docClass, text, metadata) => Chunk[]` | `Chunk[] = {text, metadata:{docClass,sectionPath,tokenCount}}` | None. For low-confidence classification, pass `DocClass.internal_sop` → dispatches to `chunkSopIso13485`, OR call `makeGenericChunker(DocClass.internal_sop)` directly. **Recommendation**: always use the registry via `chunk()`; it already falls back gracefully. |
| **Embed** | `embedChunks(texts)` (`lib/ingest/embed.ts:78`) | `(texts: string[]) => Promise<number[][]>` | Embeddings (1536-dim); throws on PII guard | None. Already batched (`BATCH_SIZE=100`), retried (`MAX_RETRIES=3`), PII-guarded. |
| **Upsert sections** | (mirror `runDeltaSync` steps 7a–7e) (`lib/radar/delta-sync/orchestrator.ts:194-260`) | `withTenantScope(orgId, tx => ...)` | Inserted section rows | **NEW orchestrator** — but the per-section INSERT pattern is copy-clear from `orchestrator.ts:210-235`. No primitive extraction needed; the loop body is inlined. |
| **Supersede stale** | `applyOutdateOperations({orgId, existingChunkIds, newIngestionRunId, actorId})` (`lib/radar/delta-sync/ingest.ts:96`) | `(params) => Promise<{applied, results}>` | Marks `superseded_by`, emits Part 11 audit | None. `resolveExistingChunkIds(sourceId, orgId)` (`orchestrator.ts:336`) also reused as-is. |

### Key finding

**`lib/ingest` has a fully composable pipeline.** Every primitive exists and is
exported. The gap is **not** a missing function — it is the **absence of a
per-file repo orchestrator** that loops the primitives over a directory tree.
The `runDeltaSync` orchestrator in `lib/radar/delta-sync/orchestrator.ts` is the
architectural template: it already composes `chunkForDelta → embedChunks →
assembleEmbeddedChunks → INSERT source_sections (org-scoped tx) →
applyOutdateOperations` with `corpus_sync_runs` history + Part 11 audit. The
`ingestDocuments` function becomes a thin per-file loop calling the **same
primitives** (not `runDeltaSync` itself — see §4.2 for rationale).

---

## 3. `ingestDocuments` Implementation Design

### 3.1 High-level flow

```
ingestDocuments(repoPath, ksSourceId, orgId)
  │
  ├─ 0. Resolve/create the parent `sources` row for this knowledge_source
  │     (1 knowledge_source : 1 sources row per FILE — see §3.2)
  │
  ├─ 1. scanRepoFiles(repoPath) → ScannedFile[]
  │     • filter by extension (PDF/DOCX/TXT/MD)
  │     • enforce caps (§3.5): MAX_FILES, MAX_TOTAL_SIZE, MAX_FILE_SIZE
  │     • skip binary/unsupported silently (logged at warn)
  │
  ├─ 2. Create ONE corpus_sync_runs row (status='pending')
  │     • crawlerName = 'knowledge-source'
  │     • sourceUrl  = `git://${knowledgeSource.sourceHost}/${knowledgeSource.sourceOwner}/${knowledgeSource.sourceRepo}#${branch}`
  │
  ├─ 3. FOR EACH file (sequential — embed API is the bottleneck):
  │     │
  │     ├─ a. extractText (or UTF-8 read for .txt/.md)
  │     ├─ b. classifyDocument → docClass (fallback internal_sop)
  │     ├─ c. redactPiiForIngest(text, docClass) → redactedText
  │     ├─ d. chunk(docClass, redactedText, {relPath, orgId}) → Chunk[]
  │     ├─ e. embedChunks(chunks.map(c => c.text)) → embeddings
  │     │     (batched internally by embedChunks; per-file batch is fine)
  │     ├─ f. resolveExistingChunkIds(fileSourceId, orgId) → oldIds[]
  │     ├─ g. withTenantScope(orgId, tx => INSERT source_sections)
  │     │     • anchor = `${sha8(relPath)}-${i}`
  │     │     • sectionPath = relPath + '#' + chunk.metadata.sectionPath
  │     │     • chunkHash = computeChunkHash(chunk.text)
  │     │     • ingestionRunId = runId
  │     ├─ h. applyOutdateOperations({orgId, existingChunkIds: oldIds,
  │     │     newIngestionRunId: runId, actorId: null})
  │     └─ [per-file try/catch — one bad file logs + continues]
  │
  ├─ 4. UPDATE corpus_sync_runs SET status='synced',
  │     chunks_added, chunks_outdated, completedAt
  │
  └─ 5. Return {filesProcessed, chunksAdded, chunksOutdated, errors[]}
```

### 3.2 Source modeling: `knowledge_sources` ↔ `sources` ↔ `source_sections`

```
knowledge_sources (D-1 table)
  id (uuid)          ← ksSourceId passed to ingestDocuments
  gitUrl, branch, sourceHost, sourceOwner, sourceRepo
        │
        │  1 : N  (one row per FILE in the repo)
        ▼
sources (REQ-FND-037)
  id (uuid)          ← fileSourceId, per file
  organizationId     ← orgId
  orgLabel           ← `${sourceOwner}/${sourceRepo}:${branch}`
  title              ← basename(file)
  type               ← 'internal_sop' (sourceTypeEnum — closest match;
  │                     repo content is internal guidance)
  sourceHost/Owner/Repo/Branch/Ref/Path  ← provenance from gitUrl + relPath
  contentHash        ← SHA256 of the file's redacted text
  ingestionRunId     ← runId (corpus_sync_runs.id)
  approvalStatus     ← 'pending_review' (default — RA-owner gate, REQ-SOURCE-GOV-009)
        │
        │  1 : N  (one row per CHUNK)
        ▼
source_sections (REQ-FND-044a)
  sourceId           ← fileSourceId
  anchor             ← `${sha8(relPath)}-${i}` (UNIQUE per source)
  heading            ← chunk.metadata.sectionPath
  text               ← chunk.text
  chunkHash          ← computeChunkHash(chunk.text)
  sectionPath        ← `${relPath}#${chunk.metadata.sectionPath}`
  ingestionRunId     ← runId
  embedding          ← embeddings[i]  (vector(1536))
  superseded_by      ← null (new); prior rows set by applyOutdateOperations
```

**Why 1 knowledge_source : N sources (one per file)?** This matches the existing
provenance schema (`sources.sourcePath` is per-file) and enables correct
per-file supersession on re-sync (only stale chunks for the changed file are
superseded, not the whole repo). The alternative — 1 `sources` row for the whole
repo — would force whole-repo supersession on every sync and lose file-level
traceability.

### 3.3 `scanRepoFiles` — repo walker (new, ~40 LOC)

```
scanRepoFiles(repoPath) → Promise<ScannedFile[]>
  - fs.readdir recursive, skip:
      .git/, node_modules/, dist/, .next/, binary extensions
  - collect files with extensions: .pdf .docx .txt .md
  - map ext → mimeType:
      .pdf  → application/pdf
      .docx → application/vnd.openxmlformats-officedocument.wordprocessingml.document
      .txt  → text/plain
      .md   → text/markdown
  - return [{absPath, relPath, mimeType, size}]
```

No new module file required — implement as a private helper inside
`lib/knowledge-sources/sync.ts` or extract to `lib/knowledge-sources/scan.ts`
if the file exceeds 400 LOC (judgment call at implementation time).

### 3.4 TXT/MD extraction gap

`extractText` throws `ExtractError` for `text/plain` / `text/markdown`. In
`ingestDocuments`, branch on mimeType **before** calling `extractText`:

```ts
let rawText: string;
if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
  rawText = await fs.readFile(absPath, 'utf-8');
} else {
  const buf = await fs.readFile(absPath);
  rawText = await extractText(buf, mimeType);
}
```

This is the only place where knowledge-source ingestion diverges from the
DOCINGEST upload path, and it requires no change to `lib/ingest/extract`.

### 3.5 Concurrency, batching, caps (DoS defense)

| Limit | Value | Rationale |
|---|---|---|
| `MAX_FILES` | 500 | Bounds total work; typical SOP repo < 100 files. |
| `MAX_FILE_SIZE` | 10 MB | PDFs larger than this are usually image-only scans (extraction yields garbage). |
| `MAX_TOTAL_SIZE` | 100 MB | Bounds embedding cost (~$0.02 per 1M tokens at text-embedding-3-small). |
| File loop | **Sequential** | OpenAI embed API is the bottleneck; parallel files would just batch into the same `BATCH_SIZE=100` call. Per-file sequential also bounds memory. |
| Embed batching | `embedChunks` internal (`BATCH_SIZE=100`) | Already optimal — no change. |
| Per-file error | `try/catch` continues to next file | One corrupt PDF must not fail the repo. Errors collected into `errors[]` and surfaced in `corpus_sync_runs.error_message` (truncated) + audit. |

### 3.6 Error handling per file

```ts
for (const file of files) {
  try {
    // ... extract, classify, redact, chunk, embed, upsert, supersede
    filesProcessed++;
  } catch (err) {
    errors.push({ relPath: file.relPath, error: messageOf(err) });
    logger.warn('[ingestDocuments] file failed', { relPath, error });
    // CONTINUE — do not throw
  }
}
```

If `errors.length === files.length` (every file failed), throw after the loop so
the outer `syncKnowledgeSource` catch flips `syncStatus='failed'`. Otherwise
the run is a partial success — `syncStatus='synced'` with `errors[]` in the
audit `meta_json`.

---

## 4. `sync.ts` Integration

### 4.1 Compose with existing `cloneRepo` (RCE defense preserved)

`syncKnowledgeSource` already calls `cloneRepo` (lines 59) with full RCE/SSRF
defense (`execFile` + `GIT_REF_PATTERN` + `isInternalHost`). **This is preserved
verbatim.** The only change inside `syncKnowledgeSource` is removing the TODO
comment on line 62 — `ingestDocuments` is now real.

### 4.2 Why not call `runDeltaSync` directly?

`runDeltaSync` (`lib/radar/delta-sync/orchestrator.ts:95`) takes a single
`{rawContent, sourceUrl, sourceId}` — it is per-single-content. A repo is N
files. Calling `runDeltaSync` per file would:

- create N `corpus_sync_runs` rows (one per file) — loses repo-level run visibility;
- re-resolve `existingHash` per file using `sourceUrl` semantics that don't map
  to repo file paths;
- bypass the knowledge-source-level `corpus_sync_runs` summary we want.

**Decision**: `ingestDocuments` reuses the **primitive operations**
(`chunkForDelta` / `embedChunks` / `assembleEmbeddedChunks` /
`applyOutdateOperations` / `resolveExistingChunkIds`) but creates ONE
repo-level `corpus_sync_runs` row and loops files itself. This mirrors the
`runDeltaSync` internal structure without forcing the single-content contract.

### 4.3 `lastSyncedAt` / `syncStatus` / audit (existing, unchanged)

`syncKnowledgeSource` already (lines 66-108):
- `UPDATE knowledge_sources SET lastSyncedAt, syncStatus='synced'` on success;
- `UPDATE knowledge_sources SET syncStatus='failed'` on error;
- writes `knowledge_source.synced` audit on both paths.

**No change needed.** The `ingestDocuments` return value
(`{filesProcessed, chunksAdded, chunksOutdated, errors}`) is folded into the
existing audit `meta_json` so the audit trail is enriched, not duplicated.

### 4.4 `corpus_sync_runs` entry

`ingestDocuments` creates ONE `corpus_sync_runs` row for the whole repo:

```ts
const runRow = await db.insert(corpusSyncRuns).values({
  crawlerName: 'knowledge-source',
  sourceUrl: `git://${ks.sourceHost}/${ks.sourceOwner}/${ks.sourceRepo}#${ks.branch}`,
  contentHash: '',                                    // filled post-scan
  status: 'pending',
}).returning({ id });
const runId = runRow[0].id;
```

On completion, update with `chunks_added`, `chunks_outdated`, `status='synced'`,
`completedAt`. On failure, `status='failed'` + `error_message` (truncated). This
is the same lifecycle as `runDeltaSync` steps 2 / 7e / 8.

### 4.5 Supersession for re-sync

When `syncKnowledgeSource` runs again (weekly cron or manual):

1. `ingestDocuments` resolves `fileSourceId` per file by querying
   `sources` on `(organizationId, sourceHost, sourceOwner, sourceRepo, sourcePath)`.
   - If found → re-use the existing `sources.id` (so `source_sections` anchor
     uniqueness is preserved).
   - If not found → INSERT new `sources` row.
2. Before inserting new sections for that file, call
   `resolveExistingChunkIds(fileSourceId, orgId)` → old chunk ids.
3. After inserting new sections, call
   `applyOutdateOperations({orgId, existingChunkIds: oldIds, newIngestionRunId: runId, actorId: null})`.
   - This emits `traceability.section_superseded` per section (Part 11, M-2).
4. If the file was **deleted** from the repo between syncs, the old `sources` row
   remains but its sections are all superseded (no new sections inserted). A
   follow-up task can `UPDATE sources SET sunsetDate` for orphaned rows; out of
   scope for D-2b (logged as a known limitation, §7).

### 4.6 Orphan cleanup follow-up (RESOLVED 2026-07-01 via Issue 313/PR 315)

**Follow-up 완료**: Inngest 일일 크론(orphan-cleanup, 03:00 UTC)이 모든 `source_sections`가 superseded된 출처를 감지하여 `approval_status='sunset'`, `sunset_date=today`로 자동 전이. Sunset된 출처는 retriever에서 자동 제외(`approvalStatus !== 'approved'` 필터). Migration 0101에서 `source_approval_status` enum에 `sunset` 추가, `audit_action` enum에 `source.orphan_sunsetted` 추가. §7의 "orphan cleanup out of scope" 제약 조건이 해결됨.

### 4.7 The DOCINGEST upload-path stub (`insertChunks`)

`lib/inngest/docingest/upload-processed.ts:156-164` has a **stub `insertChunks`**
that returns `chunks.length` without writing to the DB. This is a pre-existing
project-wide gap (`@MX:TODO` on line 141), **NOT** introduced by D-2b. D-2b will
implement the real upsert pattern in `ingestDocuments` (inlined from the
delta-sync template). A follow-up issue should refactor both `ingestDocuments`
and `upload-processed.ts:insertChunks` to share a single `upsertSourceSections`
helper — **but that extraction is out of scope for D-2b** (see §8).

---

## 5. Acceptance Criteria (Testable)

| # | Criterion | Verification |
|---|---|---|
| AC-1 | Given a temp dir with 3 `.md` files (10 lines each), `ingestDocuments` populates `source_sections` with ≥ 3 rows (one chunk min per file), each with non-null `embedding`, correct `organizationId` via the parent `sources` row, and `sourcePath` matching the relative file path. | Unit test: mock `embedChunks` → fixed vector; assert `source_sections` rows via in-memory DB mock. |
| AC-2 | Given a repo with a `.pdf` and a `.docx`, `ingestDocuments` calls `extractText` for both and produces chunks with `sectionPath` prefixed by the relative file path. | Unit test: spy on `extractText`, assert call args. |
| AC-3 | Given a `.txt` file, `ingestDocuments` reads it as UTF-8 and does NOT call `extractText` (avoids `ExtractError`). | Unit test: spy on `extractText`, assert not called for `.txt`. |
| AC-4 | `redactPiiForIngest` is invoked before `chunk` for every file, and `embedChunks` receives the redacted text (not raw). | Unit test: spy on `redactPiiForIngest` + `embedChunks`, assert call order + arg passing. |
| AC-5 | On re-sync of the same repo, prior `source_sections` for each file have `superseded_by` set to the new `runId` (via `applyOutdateOperations`), and new sections are inserted. | Integration test: two `ingestDocuments` calls, assert `superseded_by` propagation. |
| AC-6 | A repo containing one corrupt PDF (`extractText` throws) does NOT fail the whole run: `syncStatus='synced'`, other files' chunks are present, and the error is recorded in `corpus_sync_runs.error_message` + audit `meta_json.errors`. | Unit test: stub `extractText` to throw for one file; assert continuation. |
| AC-7 | A repo exceeding `MAX_FILES=500` is truncated; a warning is logged and the run still succeeds (partial ingestion). | Unit test: 600 fake files; assert 500 processed. |
| AC-8 | `cloneRepo` RCE/SSRF defenses (`GIT_REF_PATTERN`, `isInternalHost`, `execFile` argument array) are **unchanged** — diff `lib/knowledge-sources/sync.ts` lines 18-164 against base; only the `ingestDocuments` body (line 180+) changes. | Code review: visual diff. |
| AC-9 | One `corpus_sync_runs` row is created per `ingestDocuments` call, with `crawlerName='knowledge-source'`, transitioning `pending → synced` on success or `pending → failed` on total failure. | Integration test: query `corpus_sync_runs` post-run. |
| AC-10 | `knowledge_sources.lastSyncedAt` is updated and `syncStatus='synced'` on success (existing behavior — regression check). | Integration test (already covered by `tests/integration/knowledge-sources.test.ts` — extend). |

---

## 6. Test Strategy

### 6.1 Unit tests — `tests/unit/knowledge-sources/ingest-documents.test.ts`

Mirrors the mocking strategy of `tests/integration/knowledge-sources.test.ts`
(in-memory DB mock, mock `embedChunks`, mock `redactPiiForIngest`).

| Test | What it asserts |
|---|---|
| `ingests 3 markdown files → 3+ source_sections` | AC-1 |
| `dispatches extractText for pdf/docx` | AC-2 |
| `reads .txt as UTF-8, skips extractText` | AC-3 |
| `redact → chunk → embed order enforced` | AC-4 |
| `corrupt PDF continues to next file` | AC-6 |
| `MAX_FILES cap enforced` | AC-7 |
| `embedChunks batched call` | One `embedChunks` call per file with all chunk texts. |

**Mocking pattern** (from existing test):
- Mock `@/lib/db/client` — in-memory `sources` + `source_sections` + `corpus_sync_runs` stores.
- Mock `@/lib/ingest/embed` — `embedChunks` returns a fixed 1536-dim vector per input.
- Mock `@/lib/ingest/pii/redact` — `redactPiiForIngest` returns input unchanged (redaction tested elsewhere).
- Do **NOT** mock `chunk` / `classifyDocument` / `extractText` — exercise the real registry.

### 6.2 Integration tests — extend `tests/integration/knowledge-sources.test.ts`

Add a `describe('syncKnowledgeSource → ingestDocuments')` block that:
- Stubs `cloneRepo` (already mocked in the existing suite).
- Uses the real `ingestDocuments` with a fixture dir under `tests/fixtures/repo/`.
- Asserts AC-5 (supersession on re-sync), AC-9 (corpus_sync_runs lifecycle), AC-10 (knowledge_sources update).

### 6.3 Regression guards

- **L-009 / L-013 (memory lessons)**: run full `pnpm test` (not just target);
  verify staged scope with `git diff --cached --name-only` before commit.
- **L-010**: migration tested against real DB (if any new column — see §7).
- **PERMISSIONS count**: if a new route or permission is added, bump the
  `PERMISSIONS` constant. D-2b adds **no new route** (only fills a stub), so no
  bump expected.

---

## 7. Risks & Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **Large repo DoS** — unbounded file count/size exhausts memory, disk, or OpenAI quota. | High | Hard caps (§3.5): `MAX_FILES=500`, `MAX_FILE_SIZE=10MB`, `MAX_TOTAL_SIZE=100MB`. Files exceeding limits are skipped with a warning, not retried. |
| 2 | **Embedding cost / OpenAI outage** — repo with 500 files × 20 chunks = 10k embeddings (~$0.02). API failure mid-run. | Medium | `embedChunks` already retries (`MAX_RETRIES=3`, exponential backoff). Per-file try/catch (§3.6) ensures partial success. Failed files recorded in `corpus_sync_runs.error_message`. |
| 3 | **PII leakage / 21 CFR Part 11 reversibility** — repo content may contain PII; `saveMap` option omitted means no reversibility map for knowledge-source ingestion. | High | `redactPiiForIngest` runs **before** embed for every file (AC-4). `embedChunks` has a defense-in-depth PII guard that throws on detection. **Accepted risk**: knowledge-source repos are curated internal SOPs/guidance, not user-uploaded PHI; the `redaction_maps` reversibility artifact is scoped to DOCINGEST uploads (`documentId`-keyed) and does not map cleanly to repo files. Documented in audit `meta_json.saveMap=false`. |
| 4 | **Supersession correctness** — re-sync could orphan old chunks if `resolveExistingChunkIds` misses them (e.g., sourceId mismatch). | High | `fileSourceId` is resolved deterministically by `(orgId, sourceHost, sourceOwner, sourceRepo, sourcePath)` query — stable across syncs. `resolveExistingChunkIds` is org-scoped via JOIN (M-1 fix). AC-5 unit test covers the round-trip. |
| 5 | **Deleted-file orphans** — a file removed from the repo between syncs leaves its `sources` row + superseded sections in the DB (no garbage collection). | Low | **RESOLVED** (2026-07-01 via Issue 313/PR 315): Inngest 일일 크론(orphan-cleanup, 03:00 UTC)이 모든 source_sections가 superseded된 출처를 감지하여 `approval_status='sunset'`, `sunset_date=today`로 자동 전이. Sections are superseded (excluded from retrieval via `superseded_by IS NULL` filter). Sunset된 출처는 retriever에서 자동 제외(`approvalStatus !== 'approved'` 필터). |
| 6 | **Migration needs** — does D-2b require a new column? | Medium | **No.** All required columns exist: `sources.sourcePath/Host/Owner/Repo/Branch` (provenance), `sources.contentHash`, `source_sections.chunkHash/sectionPath/superseded_by/ingestionRunId`. **Zero migrations needed.** |
| 7 | **Concurrency with weekly cron** — cron could fire while a manual sync is in progress. | Low | `knowledge_sources.syncStatus` is the implicit lock: if `syncStatus='syncing'`, the cron step skips (the weekly-sync Inngest function already filters `syncStatus='synced'`). D-2b should set `syncStatus='syncing'` at the start of `syncKnowledgeSource` (small enhancement to the existing flow). |

---

## 8. Scope Discipline — What NOT to Touch

| Do NOT modify | Reason |
|---|---|
| `lib/knowledge-sources/sync.ts` lines 18-164 (`cloneRepo`, `isInternalHost`, `GIT_REF_PATTERN`) | RCE/SSRF defense — security-critical, out of scope. |
| `lib/ingest/embed.ts` (`embedChunks`, `BATCH_SIZE`, `MAX_RETRIES`, PII guard) | Shared by DOCINGEST upload + delta-sync. Changes ripple. |
| `lib/ingest/chunkers/*` | Registry is stable; no new chunker family for repo files. |
| `lib/ingest/pii/redact.ts` | Shared redaction policy — changes affect PHI handling. |
| `lib/radar/delta-sync/*` | `runDeltaSync` + primitives are reused as-is, not modified. |
| `sources.type` enum, `sourceApprovalStatusEnum`, `sourceTypeEnum` | Schema enums are frozen. |
| `lib/inngest/docingest/upload-processed.ts` | The stub `insertChunks` is a pre-existing `@MX:TODO` — refactor to a shared `upsertSourceSections` helper is a **follow-up issue**, not D-2b. |
| `.moai/specs/SPEC-REGULA-DOCINGEST-001/*` | SPEC is `status: completed` — no edits. |
| Frontend / settings UI | Separate Phase D-3. |

---

## 9. Implementation Scope (for expert-backend delegation)

**Single-file change**: `lib/knowledge-sources/sync.ts` (replace stub body lines
180-186 with the real implementation + add private helpers `scanRepoFiles`,
`resolveOrCreateFileSource`, `upsertFileSections`).

**New test files**:
- `tests/unit/knowledge-sources/ingest-documents.test.ts` (unit, mocked embed/DB)
- Extend `tests/integration/knowledge-sources.test.ts` with a re-sync block.

**Estimated LOC**: ~250 (implementation) + ~300 (tests).

**No new dependencies.** No migrations. No env var additions (OpenAI key already
required by DOCINGEST).

**Delegation prompt scope**: "Implement `ingestDocuments` per
`docs/proposals/phase-d-2b-ingestion-plan-2026-06-30.md`. Reuse
`chunk`/`embedChunks`/`redactPiiForIngest`/`extractText`/`applyOutdateOperations`
as black boxes. Do NOT modify `cloneRepo` or any `lib/ingest/*` file. Add unit
tests mirroring `tests/integration/knowledge-sources.test.ts` mocking strategy."

---

## 10. Open Questions (for orchestrator approval)

| # | Question | Default if approved silently |
|---|---|---|
| Q1 | Is the 1 knowledge_source : N sources (per-file) modeling acceptable, or should we use 1 sources row per repo (whole-repo supersession)? | **Per-file** (recommended — preserves file-level traceability). |
| Q2 | Should `syncStatus='syncing'` be set at sync start (concurrency lock, Risk 7)? | **Yes** — small enhancement to `syncKnowledgeSource`. |
| Q3 | Should orphan `sources` rows for deleted files be cleaned up in D-2b or deferred? | **RESOLVED** (2026-07-01 via Issue 313/PR 315): Inngest 일일 크론(orphan-cleanup)이 sunset 상태로 자동 전이. |
| Q4 | Is the omission of `saveMap` (Part 11 reversibility) for knowledge-source ingestion acceptable? | **Yes** — documented in audit; repo content is curated internal guidance, not user PHI. |

---

Version: 1.0.0
Author: manager-strategy (design)
Approval: pending
