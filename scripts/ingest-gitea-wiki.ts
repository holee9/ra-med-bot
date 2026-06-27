// Gitea Wiki Read-Only Ingestion Adapter (Issue #155)
//
// Fetches markdown files from Gitea wiki repository for RA knowledge base ingestion.
// Read-only access only — no write operations to Gitea.
//
// Usage:
//   pnpm tsx scripts/ingest-gitea-wiki.ts
//
// Requires: GITEA_URL, GITEA_TOKEN, GITEA_WIKI_REPO in environment
//
// @MX:ANCHOR [AUTO] Read-only Gitea wiki ingestion — hardened fetch path.
// @MX:REASON fan_in will grow (ingest cron, admin retry, replay). Security-critical:
//   Gitea error bodies have been observed to echo the Authorization header back.
//   This module MUST sanitize every thrown error so tokens never reach logs/Sentry.

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { withRetry } from '../lib/api/error-handling';
import { db } from '../lib/db/client';
import { sourceSections, sources } from '../lib/db/schema';
import { getEnv } from '../lib/env';
import { sanitizeGiteaErrorBody } from '../lib/gitea/sanitize';
import { assertGiteaUrlAllowed } from '../lib/gitea/url-guard';
import { makeGenericChunker } from '../lib/ingest/chunkers/generic';
import { DocClass } from '../lib/ingest/doc-class';
import { logger } from '../lib/observability/logger';
import { computeHash } from './seed-local-docs';

interface GiteaWikiPage {
  path: string; // e.g., "path/to/page.md"
  sha: string;
  content: string;
}

interface GiteaWikiResponse {
  data: {
    repository: {
      wiki: {
        pages: {
          nodes: GiteaWikiPage[];
        };
      };
    };
  };
}

// @MX:NOTE [AUTO] Token-leak sanitizer + URL guard are shared via lib/gitea/*.
// @MX:REASON Some Gitea error responses echo the request Authorization header in
//   the response body (e.g. `Authorization: token <TOKEN>` in 401 debug pages).
//   Interpolating raw errorText into a thrown Error would leak the token to
//   Sentry, logs, and operators. The sanitizer (stripTokens / sanitizeGiteaErrorBody)
//   is shared with the issue-write path so the two cannot drift. The URL guard
//   applies the SAME policy as the issue path (https OR internal host) — the read
//   token is no less sensitive than the write token.

/**
 * Fetch all wiki pages from Gitea repository.
 * Uses GraphQL API to fetch page paths, SHAs, and content.
 *
 * Hardened (AC3): wrapped in `withRetry` (3 attempts, 1s base delay) so
 * transient 5xx/ network blips don't abort an ingestion run. Every thrown
 * error is passed through `sanitizeGiteaErrorBody` so credential leaks in
 * upstream error bodies are stripped before reaching logs/Sentry.
 */
async function fetchGiteaWikiPages(): Promise<GiteaWikiPage[]> {
  const env = getEnv();
  const giteaUrl = env.GITEA_URL;
  const giteaToken = env.GITEA_TOKEN;
  const wikiRepo = env.GITEA_WIKI_REPO;

  if (!giteaUrl || !giteaToken || !wikiRepo) {
    throw new Error(
      'Gitea credentials not configured. Set GITEA_URL, GITEA_TOKEN, and GITEA_WIKI_REPO.',
    );
  }

  // SECURITY: SSRF guard — same policy as the issue-write path. GITEA_TOKEN is
  // a read PAT and travels as an Authorization header; it must never be sent
  // to a public untrusted HTTP host. Allow https OR an internal/private host.
  // Coherence: previously the read path had no guard while the issue path did,
  // an incoherent policy for the same env var.
  try {
    assertGiteaUrlAllowed(giteaUrl);
  } catch (err) {
    // Sanitize for operator logs — the message from assertGiteaUrlAllowed is
    // already generic (no raw URL echoed), but we truncate for safety.
    const reason = err instanceof Error ? err.message.slice(0, 200) : String(err);
    logger.warn(`Gitea wiki ingestion skipped: ${reason}`);
    throw new Error(reason);
  }

  const query = `
    query {
      repository(owner: "${wikiRepo.split('/')[0]}", name: "${wikiRepo.split('/')[1]}") {
        wiki {
          pages {
            nodes {
              path
              sha
              content
            }
          }
        }
      }
    }
  `;

  // withRetry retries on 5xx / network errors and rethrows on 4xx immediately.
  // The inner closure throws a sanitized Error so the retry loop's `lastError`
  // (and the final rethrow) never carries the raw Authorization header.
  return withRetry(
    async () => {
      const response = await fetch(`${giteaUrl}/api/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${giteaToken}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const safeBody = sanitizeGiteaErrorBody(errorText);
        // SECURITY: status code is safe; body is redacted + truncated.
        // NEVER interpolate giteaToken or the raw errorText here.
        throw new Error(`Gitea API error: ${response.status} ${safeBody}`);
      }

      const data: GiteaWikiResponse = await response.json();
      logger.info(`Fetched ${data.data.repository.wiki.pages.nodes.length} wiki pages from Gitea`);
      return data.data.repository.wiki.pages.nodes;
    },
    { maxAttempts: 3, delayMs: 1000 },
  );
}

/**
 * Ingest Gitea wiki pages into source_sections.
 * Creates source entry if not exists, then inserts all wiki pages as sections.
 */
async function ingestGiteaWiki(): Promise<void> {
  const env = getEnv();
  const giteaUrl = env.GITEA_URL;
  const wikiRepo = env.GITEA_WIKI_REPO;
  const ingestionRunId = randomUUID();
  const ingestedAt = new Date();

  if (!giteaUrl || !wikiRepo) {
    logger.warn('Gitea not configured, skipping wiki ingestion');
    return;
  }

  logger.info(`Starting Gitea wiki ingestion from ${giteaUrl}/${wikiRepo}`);

  // Fetch wiki pages
  const pages = await fetchGiteaWikiPages();

  if (pages.length === 0) {
    logger.warn('No wiki pages found, skipping ingestion');
    return;
  }

  // Find or create source entry
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.title, `Gitea Wiki (${wikiRepo})`))
    .limit(1);

  let sourceId: string;

  if (existing.length > 0 && existing[0]) {
    sourceId = existing[0].id;
    logger.info(`Source exists, reusing: Gitea Wiki (${sourceId.substring(0, 8)})`);
  } else {
    const host = new URL(giteaUrl).hostname;
    const [owner, repo] = wikiRepo.split('/');

    const inserted = await db
      .insert(sources)
      .values({
        orgLabel: 'Internal',
        title: `Gitea Wiki (${wikiRepo})`,
        year: new Date().getFullYear(),
        type: 'Internal',
        // REQ-SOURCE-GOV-004/008 — internal SOP wiki = internal_sop authority.
        authorityGrade: 'internal_sop',
        region: 'KR',
        url: `${giteaUrl}/${wikiRepo}/wiki`,
        // Provenance fields for Gitea source
        sourceHost: host,
        sourceOwner: owner,
        sourceRepo: repo,
        sourceBranch: 'main', // Gitea default branch
        sourceRef: null, // Will be updated per page SHA
        sourcePath: 'wiki',
        contentHash: null,
        ingestionRunId,
        ingestedAt,
        embedding: null as unknown as number[],
      })
      .returning({ id: sources.id });

    const row = inserted[0];
    if (!row) throw new Error('Insert failed for Gitea Wiki source');
    sourceId = row.id;
    logger.info(`Created source: Gitea Wiki (${sourceId.substring(0, 8)})`);
  }

  // Ingest each wiki page as a source section
  const chunker = makeGenericChunker(DocClass.internal_sop);
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const page of pages) {
    try {
      const chunks = chunker(page.content, {});
      if (chunks.length === 0) continue;

      // Use the first chunk's metadata for the section
      const chunk = chunks[0];
      if (!chunk) continue;
      const heading =
        chunk.metadata.sectionPath !== 'Document' ? chunk.metadata.sectionPath : page.path;

      // Anchor: wiki path + chunk index (unique per page)
      const anchor = `${page.path}#${0}`;

      const chunkHash = computeHash(chunk.text);
      const sectionPath = `${page.path}#${0}`;

      await db.insert(sourceSections).values({
        sourceId,
        anchor: anchor.substring(0, 500),
        heading: heading.substring(0, 500),
        text: chunk.text.substring(0, 8000),
        // Section-level provenance
        chunkHash,
        sectionPath,
        ingestionRunId,
        ingestedAt,
        embedding: null as unknown as number[],
      } as typeof sourceSections.$inferInsert);

      totalInserted++;
      logger.info(`Ingested wiki page: ${page.path}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && typeof err.cause === 'object' && err.cause !== null
          ? (err.cause as { code?: unknown })
          : undefined;
      const isUnique =
        msg.includes('source_sections_source_anchor_idx') ||
        msg.includes('unique constraint') ||
        cause?.code === '23505';

      if (isUnique) {
        totalSkipped++;
        logger.warn(`Skipped duplicate wiki page: ${page.path}`);
        continue;
      }
      throw err;
    }
  }

  logger.info(`Gitea wiki ingestion complete: ${totalInserted} inserted, ${totalSkipped} skipped`);
}

// CLI entrypoint
async function main(): Promise<void> {
  try {
    await ingestGiteaWiki();
    process.exit(0);
  } catch (err) {
    logger.error('Gitea wiki ingestion failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ingestGiteaWiki, fetchGiteaWikiPages };
