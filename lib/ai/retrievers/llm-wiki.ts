// @MX:ANCHOR [AUTO] LlmWikiRetriever — llm-wiki(Gitea DR_RnD/ra-llm-wiki) 선별 지식 계층 검색.
// @MX:REASON 지식 계층 ② 연결(계층 ① nas-docs와 상호 보완): ①전수 NAS가 recall,
//           ②wiki가 검증된 종합을 담당 — ECOSYSTEM 헌장 원칙 5. fan_in 3+
//           (merge registry · router always-include · 리트리버 테스트).
// @MX:SPEC docs/proposals/llm-wiki-retriever-design-2026-10-23.md (AI-CONSUMER-GUIDE v1.0)
//
// Consumption contract (measured 2026-10-28, SHA f1d939a):
//   Gitea API only (no clone) — refs/heads/main → fixed SHA per retrieval;
//   catalog manifest wiki/indexes/agent/catalog.json + per-type JSONL shards
//   (64,114 entries); bodies via contents/{path}?ref={SHA}.
// B-plan (keyword catalog search) first — A-plan (embedding cache) is a
// follow-up gated on the 42-case A/B measurement.
//
// Security (규약 v1.0): wiki 컨파일은 내부 자산 = [내부]. Chunks surface only
// inside the authenticated app; nothing from here enters any git remote.
// Every result carries the 출처 포인터 (original NAS doc path) because the
// wiki is a compilation — the original document, not the wiki, is the truth
// source (3-session merge principle 1, 2026-10-23).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

// Env is read at call time (not module load) so test/process env changes apply —
// the nas-docs module-load pattern silently breaks under vitest env injection.
function giteaConfig(): { url: string; token: string; repo: string } {
  return {
    url: process.env.GITEA_URL ?? '',
    token: process.env.GITEA_TOKEN ?? '',
    repo: process.env.GITEA_WIKI_REPO ?? 'DR_RnD/ra-llm-wiki',
  };
}
const INDEX_DIR = 'wiki/indexes/agent';
const WIKI_ORG_LABEL = 'llm-wiki';
const DEFAULT_CACHE_PATH = 'var/llm-wiki/catalog-cache.json';
function cachePath(): string {
  return process.env.LLM_WIKI_CACHE_PATH ?? DEFAULT_CACHE_PATH;
}
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // design: 일 1회 갱신
const MAX_BODY_CHARS = 4000;
const MAX_DOCS = 3; // wiki는 종합 계층 — NAS(recall)보다 적은 문서 수로 균형
const MIN_MATCH_SCORE = 0.2;

interface WikiEntry {
  path: string;
  type: string;
  title: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  updated?: string;
}

interface CatalogCache {
  sha: string;
  fetchedAt: number;
  entries: WikiEntry[];
}

/** Memoized proxy source row id (seeded once — scripts/seed-llm-wiki-source.ts). */
let cachedSourceId: string | null | undefined;

async function resolveSourceId(): Promise<string | null> {
  if (cachedSourceId !== undefined) return cachedSourceId;
  try {
    // Dynamic import keeps env validation out of unrelated unit tests (nas-docs pattern).
    const { db } = await import('@/lib/kernel/db/client');
    const { sources } = await import('@/lib/kernel/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.orgLabel, WIKI_ORG_LABEL))
      .limit(1);
    cachedSourceId = row?.id ?? null;
  } catch {
    cachedSourceId = null;
  }
  return cachedSourceId;
}

async function gitea(path: string, timeoutMs = 8000): Promise<unknown> {
  const { url, token } = giteaConfig();
  const res = await fetch(`${url}/api/v1${path}`, {
    headers: { Authorization: `token ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`gitea_${res.status}`);
  return res.json();
}

/** Raw file bytes (no base64 inflation — the contents API doubles payload size). */
async function fetchRaw(path: string, sha: string, timeoutMs = 30000): Promise<string> {
  const { url, token, repo } = giteaConfig();
  const res = await fetch(`${url}/api/v1/repos/${repo}/raw/${path}?ref=${sha}`, {
    headers: { Authorization: `token ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`gitea_${res.status}`);
  return res.text();
}

async function fetchMainSha(): Promise<string> {
  const { repo } = giteaConfig();
  const refs = (await gitea(`/repos/${repo}/git/refs/heads/main`)) as Array<{
    object: { sha: string };
  }>;
  const sha = refs?.[0]?.object?.sha;
  if (!sha) throw new Error('gitea_no_sha');
  return sha;
}

async function fetchFile(path: string, sha: string, timeoutMs = 15000): Promise<string> {
  const d = (await gitea(
    `/repos/${giteaConfig().repo}/contents/${path}?ref=${sha}`,
    timeoutMs,
  )) as { content?: string; encoding?: string };
  if (!d?.content) throw new Error('gitea_empty_content');
  return d.encoding === 'base64' ? Buffer.from(d.content, 'base64').toString('utf-8') : d.content;
}

async function buildCatalog(sha: string): Promise<WikiEntry[]> {
  // Shard list from the index directory (the manifest carries counts, not paths).
  const { repo } = giteaConfig();
  const listing = (await gitea(`/repos/${repo}/contents/${INDEX_DIR}?ref=${sha}`)) as Array<{
    type: string;
    path: string;
  }>;
  const shards = (listing ?? []).filter((f) => f.type === 'file' && f.path.endsWith('.jsonl'));
  const entries: WikiEntry[] = [];
  let failedShards = 0;
  for (const shard of shards) {
    try {
      const body = await fetchRaw(shard.path, sha);
      for (const line of body.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          entries.push(JSON.parse(t) as WikiEntry);
        } catch {
          // tolerate a malformed line — one bad entry must not drop the corpus
        }
      }
    } catch {
      // one unreachable shard must not drop the whole corpus — partial catalog
      // beats no catalog (design: NAS still answers recall)
      failedShards += 1;
    }
  }
  // More than half the shards unreachable → treat as a broken index, not a catalog.
  if (shards.length > 0 && failedShards > shards.length / 2) {
    throw new Error(`catalog_majority_unreachable:${failedShards}/${shards.length}`);
  }
  return entries;
}

function loadDiskCache(): CatalogCache | null {
  try {
    const p = cachePath();
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as CatalogCache;
    return Array.isArray(parsed?.entries) && parsed.sha ? parsed : null;
  } catch {
    return null;
  }
}

function saveDiskCache(cache: CatalogCache): void {
  try {
    mkdirSync(dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(cache));
  } catch {
    // cache write is best-effort — retrieval still works from memory
  }
}

let memoryCache: CatalogCache | null = null;
let refreshInFlight: Promise<CatalogCache | null> | null = null;

/** Disk-backed 24h catalog cache; refreshes on TTL expiry, falls back to stale on failure. */
async function getCatalog(): Promise<CatalogCache | null> {
  memoryCache = memoryCache ?? loadDiskCache();
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) return memoryCache;

  refreshInFlight =
    refreshInFlight ??
    (async () => {
      try {
        const sha = await fetchMainSha();
        const entries = await buildCatalog(sha);
        const fresh: CatalogCache = { sha, fetchedAt: Date.now(), entries };
        memoryCache = fresh;
        saveDiskCache(fresh);
        return fresh;
      } catch {
        // Gitea unreachable — stale cache still answers (design: 장애 우회)
        if (memoryCache) {
          memoryCache = { ...memoryCache, fetchedAt: Date.now() };
          return memoryCache;
        }
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  return refreshInFlight;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

/**
 * B-plan keyword scoring: token substring match across entry fields.
 * title/aliases weigh 3, tags 2, summary 1 — coverage-normalised to [0,1].
 */
function scoreEntry(entry: WikiEntry, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const title = (entry.title ?? '').toLowerCase();
  const summary = (entry.summary ?? '').toLowerCase();
  const tags = (entry.tags ?? []).map((t) => t.toLowerCase());
  const aliases = (entry.aliases ?? []).map((a) => a.toLowerCase());
  let hit = 0;
  for (const tok of tokens) {
    if (title.includes(tok) || aliases.some((a) => a.includes(tok))) hit += 3;
    else if (tags.some((t) => t.includes(tok))) hit += 2;
    else if (summary.includes(tok)) hit += 1;
  }
  const max = tokens.length * 3;
  return hit / max; // 1.0 = every token hit the title/alias tier
}

/** Extract the best-matching section of the body (heading-split, token overlap). */
function bestSection(body: string, tokens: string[]): string {
  const sections = body.split(/(?=^#{1,3}\s)/m);
  if (sections.length <= 1) return body.slice(0, MAX_BODY_CHARS);
  let best: string | undefined;
  let bestScore = -1;
  for (const sec of sections) {
    const low = sec.toLowerCase();
    const s = tokens.reduce((acc, t) => acc + (low.includes(t) ? 1 : 0), 0);
    if (s > bestScore) {
      bestScore = s;
      best = sec;
    }
  }
  return (best ?? sections[0] ?? body).slice(0, MAX_BODY_CHARS);
}

/** 출처 포인터 — wiki frontmatter `sources:` holds the original NAS doc paths. */
function extractSourcePointer(body: string, entry: WikiEntry): string | null {
  const fm = body.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const m = fm?.[1]?.match(/sources:\s*\[([^\]]*)\]/);
    const inner = m?.[1]?.trim();
    if (inner) return inner.replace(/^["']|["']$/g, '');
  }
  return entry.type === 'source' ? entry.path : null;
}

export class LlmWikiRetriever implements IRetriever {
  readonly corpus = 'llm-wiki';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    // orgId mandatory — no unscoped retrieval (nas-docs / REQ-BREADTH-043 posture).
    if (!opts.orgId) return [];
    const cfg = giteaConfig();
    if (!cfg.url || !cfg.token) return []; // corpus not configured → inactive
    const sourceId = await resolveSourceId();
    if (!sourceId) return []; // proxy row not seeded — corpus inactive

    const cache = await getCatalog();
    if (!cache || cache.entries.length === 0) return [];

    const tokens = tokenize(query);
    const ranked = cache.entries
      .map((e) => ({ e, s: scoreEntry(e, tokens) }))
      .filter((r) => r.s >= MIN_MATCH_SCORE)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_DOCS);

    const results: RetrievalResult[] = [];
    for (const { e, s } of ranked) {
      try {
        const body = await fetchFile(e.path, cache.sha);
        results.push({
          id: `wiki-${cache.sha.slice(0, 8)}-${createHash('sha1').update(e.path).digest('hex').slice(0, 10)}`,
          content: bestSection(body, tokens),
          score: Math.min(0.9, s), // 종합 계층 상한 — 원문(NAS)이 항상 우위
          sourceId,
          metadata: {
            orgLabel: WIKI_ORG_LABEL,
            title: e.title ?? e.path,
            year: e.updated ? Number(e.updated.slice(0, 4)) || null : null,
            type: 'Internal',
            url: null,
            wikiPath: e.path,
            wikiType: e.type,
            sourcePath: extractSourcePointer(body, e), // 출처 포인터 (진실원 = 원 문서)
          },
        });
      } catch {
        // one unreachable body must not drop the other wiki results
      }
    }
    return results;
  }
}
