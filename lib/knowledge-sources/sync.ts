// @MX:NOTE [AUTO] Knowledge source sync — clones git repo and ingests via DOCINGEST pipeline.
// @MX:SPEC Issue #307 D-2b (Knowledge Ingestion) — ingestDocuments real impl.
// @MX:WARN [AUTO] cloneRepo uses execFile (argument array, no shell) + branch/host validation.
// @MX:REASON RCE 방지 — gitUrl/branch는 사용자 제어 입력. exec 문자열 보간은 shell injection.

import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { mkdir, rm } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { corpusSyncRuns, knowledgeSources, sources } from '@/lib/db/schema';
import { chunk } from '@/lib/ingest/chunkers';
import { DocClass } from '@/lib/ingest/doc-class';
import { classifyDocument } from '@/lib/ingest/doc-classifier';
import { embedChunks } from '@/lib/ingest/embed';
import { extractText } from '@/lib/ingest/extract';
import { redactPiiForIngest } from '@/lib/ingest/pii/redact';
import {
  type SourceSectionInsertRow,
  insertSourceSections,
} from '@/lib/ingest/source-sections-upsert';
import { logger } from '@/lib/observability/logger';
import { applyOutdateOperations } from '@/lib/radar/delta-sync/ingest';
import { resolveExistingChunkIds } from '@/lib/radar/delta-sync/orchestrator';
import { and, eq } from 'drizzle-orm';
import { parseGitUrl } from './parse-git-url';

const execFileAsync = promisify(execFile);

// git ref (branch) 검증 — shell metacharacter / option injection 차단.
const GIT_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

// SSRF 방어 — internal/private host 차단.
function isInternalHost(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '::1' ||
    /^127\./.test(lower) ||
    /^10\./.test(lower) ||
    /^192\.168\./.test(lower) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(lower) ||
    /^0\./.test(lower) ||
    lower.endsWith('.local') ||
    lower === 'metadata.google.internal'
  );
}

/**
 * Sync a knowledge source by cloning the repo and ingesting documents.
 * Reuses DOCINGEST pipeline: clone → chunk → embed → insert into sources/source_sections.
 *
 * @param source - Knowledge source record with id, gitUrl, branch, auth_token, orgId
 * @throws Error if clone fails or ingestion fails
 */
export async function syncKnowledgeSource(source: {
  id: string;
  gitUrl: string;
  branch: string;
  auth_token: string | null;
  orgId: string;
}): Promise<void> {
  const startTime = new Date();
  const tmpDir = join(
    process.env.TMPDIR || '/tmp',
    `knowledge-source-${source.id}-${startTime.getTime()}`,
  );

  // Concurrency lock: flip syncStatus='syncing' BEFORE clone so concurrent cron +
  // manual re-sync see the lock and skip (weekly Inngest already filters on
  // syncStatus='synced'; 'syncing' is the active-run signal).
  await db
    .update(knowledgeSources)
    .set({ syncStatus: 'syncing' })
    .where(eq(knowledgeSources.id, source.id));

  try {
    // Step 1: Clone repository (execFile + validation — RCE 방어)
    await cloneRepo(source.gitUrl, source.branch, tmpDir, source.auth_token);

    // Step 2: Ingest documents using DOCINGEST pipeline primitives.
    const stats = await ingestDocuments(tmpDir, source.id, source.orgId);

    // Step 3: Update last_synced_at and sync_status
    await db
      .update(knowledgeSources)
      .set({
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      })
      .where(eq(knowledgeSources.id, source.id));

    // Step 4: Write audit log (성공) — enriched with per-file stats
    await writeAudit({
      actor_id: null, // System-initiated (cron 또는 수동)
      action: 'knowledge_source.synced',
      resource_type: 'knowledgeSource',
      resource_id: source.id,
      meta_json: {
        gitUrl: source.gitUrl,
        branch: source.branch,
        duration: Date.now() - startTime.getTime(),
        status: 'synced',
        filesProcessed: stats.filesProcessed,
        chunksAdded: stats.chunksAdded,
        chunksOutdated: stats.chunksOutdated,
        errors: stats.errors,
      },
    });
  } catch (error) {
    // Update sync_status to failed
    await db
      .update(knowledgeSources)
      .set({ syncStatus: 'failed' })
      .where(eq(knowledgeSources.id, source.id));

    // Write failure audit — 'knowledge_source.synced' action + meta.status='failed'
    // (sync_failed action은 migration 0099에 미정의 → enum 안전하게 synced 재사용)
    await writeAudit({
      actor_id: null,
      action: 'knowledge_source.synced',
      resource_type: 'knowledgeSource',
      resource_id: source.id,
      meta_json: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        gitUrl: source.gitUrl,
        branch: source.branch,
      },
    });

    throw error;
  } finally {
    // Cleanup: remove temporary directory
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Clone a Git repository to a temporary directory.
 * 보안: execFile(argument array, shell=false) + branch/host 검증 → RCE/SSRF 방어.
 */
async function cloneRepo(
  gitUrl: string,
  branch: string,
  targetDir: string,
  authToken: string | null,
): Promise<void> {
  // branch 검증 — git ref 형식 + 옵션 인젝션(.., -) 차단
  if (!GIT_REF_PATTERN.test(branch) || branch.includes('..') || branch.startsWith('-')) {
    throw new Error(`invalid_branch: ${branch}`);
  }

  // gitUrl 검증 — parse + SSRF(internal host 차단)
  const parsed = parseGitUrl(gitUrl);
  if (!parsed) {
    throw new Error(`invalid_git_url: ${gitUrl}`);
  }
  if (isInternalHost(parsed.host)) {
    throw new Error(`internal_host_blocked: ${parsed.host}`);
  }

  await mkdir(targetDir, { recursive: true });

  let cloneUrl = gitUrl;
  if (authToken && gitUrl.startsWith('https://')) {
    // private repo — auth token 주입 (HTTPS only). SSH는 별도 키 필요.
    const url = new URL(gitUrl);
    url.username = authToken;
    cloneUrl = url.toString();
  }

  // execFile 인자 배열 — shell 미사용 → injection 불가.
  await execFileAsync(
    'git',
    ['clone', '--depth', '1', '--single-branch', '--branch', branch, cloneUrl, targetDir],
    {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
}

// ---------------------------------------------------------------------------
// Ingestion pipeline (Issue #307 D-2b).
// Reuses DOCINGEST primitives + delta-sync supersession pattern. See
// docs/proposals/phase-d-2b-ingestion-plan-2026-06-30.md for the design.
// ---------------------------------------------------------------------------

// HARD caps (DoS defense — design §3.5).
const MAX_FILES = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB

const EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

// Skip these directories during repo walk.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', 'build', '.cache']);

interface ScannedFile {
  absPath: string;
  relPath: string;
  mimeType: string;
  size: number;
}

interface IngestStats {
  filesProcessed: number;
  chunksAdded: number;
  chunksOutdated: number;
  errors: { relPath: string; error: string }[];
}

/**
 * Ingest documents from a cloned repository.
 *
 * Pipeline per file: extract → classify → redact → chunk → embed → upsert.
 * Reuses extractText/classifyDocument/redactPiiForIngest/chunk/embedChunks
 * (lib/ingest) and resolveExistingChunkIds/applyOutdateOperations
 * (lib/radar/delta-sync) verbatim. Mirrors runDeltaSync 7a-7e inline.
 *
 * One sources row per file (1 knowledge_source : N sources). One
 * corpus_sync_runs row per repo. Per-file try/catch — one bad file continues.
 *
 * @param repoPath  - Path to cloned repository
 * @param sourceId  - Knowledge source ID (knowledge_sources.id)
 * @param orgId     - Organization ID (org scope for all writes)
 */
// Exported for direct unit testing (test seam). Not part of the public sync API —
// callers use syncKnowledgeSource; tests exercise the pipeline in isolation.
export async function ingestDocuments(
  repoPath: string,
  sourceId: string,
  orgId: string,
): Promise<IngestStats> {
  const stats: IngestStats = { filesProcessed: 0, chunksAdded: 0, chunksOutdated: 0, errors: [] };

  // Resolve knowledge_source row for provenance fields.
  const ksRows = await db
    .select({
      sourceHost: knowledgeSources.sourceHost,
      sourceOwner: knowledgeSources.sourceOwner,
      sourceRepo: knowledgeSources.sourceRepo,
      branch: knowledgeSources.branch,
    })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
    .limit(1);
  const ks = ksRows[0];
  if (!ks) {
    throw new Error(`knowledge_source_not_found: ${sourceId}`);
  }
  const ksHost = ks.sourceHost ?? 'unknown';
  const ksOwner = ks.sourceOwner ?? 'unknown';
  const ksRepo = ks.sourceRepo ?? 'unknown';
  const sourceUrl = `git://${ksHost}/${ksOwner}/${ksRepo}#${ks.branch}`;

  // 1. Scan repo (enforce caps).
  const files = await scanRepo(repoPath);

  // 2. Create ONE corpus_sync_runs row for the repo (pending → synced/failed).
  const runRows = await db
    .insert(corpusSyncRuns)
    .values({
      crawlerName: 'knowledge-source',
      sourceUrl,
      contentHash: '',
      status: 'pending',
      startedAt: new Date(),
    })
    .returning({ id: corpusSyncRuns.id });
  const runId = runRows[0]?.id;
  if (!runId) throw new Error('failed_to_create_corpus_sync_run');

  try {
    // 3. Per-file pipeline (sequential — embed API is the bottleneck).
    for (const file of files) {
      try {
        const added = await ingestOneFile(file, {
          repoPath,
          orgId,
          runId,
          ksHost,
          ksOwner,
          ksRepo,
          ksBranch: ks.branch,
        });
        stats.filesProcessed += 1;
        stats.chunksAdded += added.sectionsInserted;
        stats.chunksOutdated += added.outdatedApplied;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ relPath: file.relPath, error: msg });
        logger.warn('[ingestDocuments] file failed — continuing', {
          relPath: file.relPath,
          error: msg,
        });
        // CONTINUE — one bad file must not fail the repo (design §3.6).
      }
    }

    // 4. All-files-failed guard — flip to failed so the outer catch fires.
    if (files.length > 0 && stats.filesProcessed === 0) {
      throw new Error(`all_files_failed: ${stats.errors.length} files could not be ingested`);
    }

    // 5. Update corpus_sync_runs (success).
    await db
      .update(corpusSyncRuns)
      .set({
        status: 'synced',
        chunksAdded: stats.chunksAdded,
        chunksOutdated: stats.chunksOutdated,
        completedAt: new Date(),
      })
      .where(eq(corpusSyncRuns.id, runId));

    return stats;
  } catch (err) {
    // 6. Total failure — mark run failed, rethrow for outer syncKnowledgeSource.
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(corpusSyncRuns)
      .set({ status: 'failed', errorMessage: msg.slice(0, 1000), completedAt: new Date() })
      .where(eq(corpusSyncRuns.id, runId));
    throw err;
  }
}

/**
 * Walk a repo dir collecting supported files. Enforces HARD caps.
 * Skip .git/node_modules/dist and unsupported extensions.
 */
async function scanRepo(repoPath: string): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  let totalSize = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        await walk(abs);
      } else if (ent.isFile()) {
        if (out.length >= MAX_FILES) {
          logger.warn('[scanRepo] MAX_FILES cap reached — skipping remaining files', {
            cap: MAX_FILES,
          });
          return;
        }
        const ext = extname(ent.name).toLowerCase();
        const mimeType = EXT_MIME[ext];
        if (!mimeType) continue; // unsupported — skip silently
        const st = await stat(abs);
        if (st.size > MAX_FILE_SIZE) {
          logger.warn('[scanRepo] file exceeds MAX_FILE_SIZE — skipping', {
            path: abs,
            size: st.size,
          });
          continue;
        }
        if (totalSize + st.size > MAX_TOTAL_SIZE) {
          logger.warn('[scanRepo] MAX_TOTAL_SIZE cap reached — stopping scan', {
            cap: MAX_TOTAL_SIZE,
          });
          return;
        }
        totalSize += st.size;
        out.push({ absPath: abs, relPath: relative(repoPath, abs), mimeType, size: st.size });
      }
    }
  }

  await walk(repoPath);
  return out;
}

/**
 * Run the full pipeline for ONE file and upsert its sources/source_sections.
 * Mirrors runDeltaSync 7a-7e: resolve existing chunk ids → insert new sections
 * (org-scoped tx) → applyOutdateOperations for supersession.
 */
async function ingestOneFile(
  file: ScannedFile,
  ctx: {
    repoPath: string;
    orgId: string;
    runId: string;
    ksHost: string;
    ksOwner: string;
    ksRepo: string;
    ksBranch: string;
  },
): Promise<{ sectionsInserted: number; outdatedApplied: number }> {
  // a. Extract text. TXT/MD are not in extractText's SUPPORTED_MIME_TYPES;
  //    read UTF-8 directly to avoid ExtractError (design §3.4).
  let rawText: string;
  if (file.mimeType === 'text/plain' || file.mimeType === 'text/markdown') {
    rawText = await readFile(file.absPath, 'utf-8');
  } else {
    const buf = await readFile(file.absPath);
    rawText = await extractText(buf, file.mimeType);
  }

  // b. Classify — fallback to internal_sop on low confidence (design §2).
  const cls = classifyDocument({
    filename: basename(file.absPath),
    firstPageText: rawText.slice(0, 2000),
  });
  const docClass = cls.confidence >= 0.6 ? cls.suggestedClass : DocClass.internal_sop;

  // c. PII redaction (saveMap OMITTED for knowledge-sources — design §2/Q4).
  const redacted = await redactPiiForIngest(rawText, docClass);

  // d. Chunk (registry dispatches by docClass; internal_sop → chunkSopIso13485).
  const chunks = chunk(docClass, redacted.text, {
    relPath: file.relPath,
    organizationId: ctx.orgId,
  });

  // e. Embed (batched internally BATCH_SIZE=100, MAX_RETRIES=3, PII-guarded).
  const embeddings = await embedChunks(chunks.map((c) => c.text));

  // f. Resolve or create the parent sources row for this file (stable key:
  //    orgId + host/owner/repo/path so re-sync reuses the row).
  const fileSourceId = await resolveOrCreateFileSource(file, ctx);

  // g. Resolve existing chunk ids for supersession (org-scoped JOIN — M-1).
  const existingChunkIds = await resolveExistingChunkIds(fileSourceId, ctx.orgId);

  // h. INSERT new source_sections (org-scoped tx). Issue #314: delegates to the
  // shared insertSourceSections helper used by delta-sync orchestrator 7c. The
  // anchor/sectionPath provenance keys remain caller-specific (file-path based)
  // while the tx boundary + batch insert + id collection are centralized.
  const insertRows: SourceSectionInsertRow[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const emb = embeddings[i];
    if (!c || !emb) continue;
    const meta = c.metadata as { sectionPath?: string; tokenCount?: number };
    insertRows.push({
      sourceId: fileSourceId,
      anchor: `${sha8(file.relPath)}-${i}`,
      heading: meta.sectionPath ?? null,
      text: c.text,
      embedding: emb,
      sectionPath: `${file.relPath}#${meta.sectionPath ?? 'chunk'}`,
      ingestionRunId: ctx.runId,
      chunkHash: computeChunkHash(c.text),
    });
  }
  const insertedSections = await insertSourceSections(ctx.orgId, insertRows);

  // i. Supersede prior chunks for this file (re-sync path). Mirrors 7d.
  let outdatedApplied = 0;
  if (existingChunkIds.length > 0) {
    const outdateResult = await applyOutdateOperations({
      orgId: ctx.orgId,
      existingChunkIds,
      newIngestionRunId: ctx.runId,
      actorId: null,
    });
    outdatedApplied = outdateResult.applied;
  }

  return { sectionsInserted: insertedSections.length, outdatedApplied };
}

/**
 * Resolve an existing sources row for this file by stable provenance key, or
 * create a new one. Enables per-file supersession on re-sync (design §3.2/4.5).
 */
async function resolveOrCreateFileSource(
  file: ScannedFile,
  ctx: {
    orgId: string;
    runId: string;
    ksHost: string;
    ksOwner: string;
    ksRepo: string;
    ksBranch: string;
  },
): Promise<string> {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(
        eq(sources.organizationId, ctx.orgId),
        eq(sources.sourceHost, ctx.ksHost),
        eq(sources.sourceOwner, ctx.ksOwner),
        eq(sources.sourceRepo, ctx.ksRepo),
        eq(sources.sourcePath, file.relPath),
      ),
    )
    .limit(1);
  if (existing[0]?.id) return existing[0].id;

  const rows = await db
    .insert(sources)
    .values({
      id: randomUUID(),
      organizationId: ctx.orgId,
      orgLabel: `${ctx.ksOwner}/${ctx.ksRepo}:${ctx.ksBranch}`,
      title: basename(file.relPath),
      type: 'Internal',
      sourceHost: ctx.ksHost,
      sourceOwner: ctx.ksOwner,
      sourceRepo: ctx.ksRepo,
      sourceBranch: ctx.ksBranch,
      sourcePath: file.relPath,
      contentHash: computeChunkHash(file.relPath),
      ingestionRunId: ctx.runId,
      ingestedAt: new Date(),
      approvalStatus: 'pending_review', // RA-owner gate — never reaches retriever until approved
    })
    .returning({ id: sources.id });
  const id = rows[0]?.id;
  if (!id) throw new Error(`failed_to_create_source_row: ${file.relPath}`);
  return id;
}

/** 8-char hex digest for compact anchor keys (collision-bounded for anchors). */
function sha8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

/** SHA256 hex digest for chunk content / file provenance hashing. */
function computeChunkHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
