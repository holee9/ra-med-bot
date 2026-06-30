// @MX:NOTE [AUTO] Knowledge source sync — clones git repo and ingests via DOCINGEST pipeline.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)
// @MX:WARN [AUTO] cloneRepo uses execFile (argument array, no shell) + branch/host validation.
// @MX:REASON RCE 방지 — gitUrl/branch는 사용자 제어 입력. exec 문자열 보간은 shell injection.

import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { knowledgeSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  try {
    // Step 1: Clone repository (execFile + validation — RCE 방어)
    await cloneRepo(source.gitUrl, source.branch, tmpDir, source.auth_token);

    // Step 2: Ingest documents using DOCINGEST pipeline.
    // TODO(#307 D-2b): 실제 DOCINGEST 통합(chunking/embedding/pgvector upsert)은 별도.
    // 현재는 clone 검증 + 메타만. 코퍼스 채움은 ingestDocuments 구현 후.
    await ingestDocuments(tmpDir, source.id, source.orgId);

    // Step 3: Update last_synced_at and sync_status
    await db
      .update(knowledgeSources)
      .set({
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      })
      .where(eq(knowledgeSources.id, source.id));

    // Step 4: Write audit log (성공)
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

/**
 * Ingest documents from cloned repository.
 * TODO(#307 D-2b): 실제 DOCINGEST 파이프라인 통합 — 현재 stub.
 * 1. 파일 스캔(PDF/DOCX/TXT/MD)
 * 2. 텍스트 추출(lib/ingest/extract)
 * 3. PII redaction(lib/ingest/pii/redact)
 * 4. 청킹(lib/ingest/chunkers)
 * 5. 임베딩(lib/ingest/embed)
 * 6. sources/source_sections upsert
 *
 * @param repoPath - Path to cloned repository
 * @param sourceId - Knowledge source ID
 * @param orgId - Organization ID
 */
async function ingestDocuments(repoPath: string, sourceId: string, orgId: string): Promise<void> {
  // TODO(#307 D-2b): 실제 ingestion 구현 전까지 no-op. clone은 검증됨.
  // 사용자가 repo를 연동하면 clone은 성공하지만 코퍼스 채움은 D-2b 구현 후.
  void repoPath;
  void sourceId;
  void orgId;
}
