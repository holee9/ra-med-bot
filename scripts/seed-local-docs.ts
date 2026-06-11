// Ingest local Markdown repositories (ra-project, MD-process) into source_sections.
// Runs in FTS-only mode when OPENAI_API_KEY is missing/placeholder.
//
// Run: pnpm tsx scripts/seed-local-docs.ts
// Requires: DATABASE_URL in environment.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { sourceSections, sources } from '../lib/db/schema';
import { makeGenericChunker } from '../lib/ingest/chunkers/generic';
import { DocClass } from '../lib/ingest/doc-class';
import { logger } from '../lib/observability/logger';

interface LocalSource {
  repoPath: string;
  orgLabel: string;
  title: string;
  type: 'Regulation' | 'Guidance' | 'Standard' | 'Industry' | 'Internal';
  region: string;
  docClass: DocClass;
}

const RA_PROJECT_PATH =
  process.env.RA_PROJECT_PATH ?? '/home/abyz-lab/work/workspace-github/holee9/ra-project';
const MD_PROCESS_PATH =
  process.env.MD_PROCESS_PATH ?? '/home/abyz-lab/work/workspace-github/holee9/MD-process';

const LOCAL_SOURCES: LocalSource[] = [
  {
    repoPath: RA_PROJECT_PATH,
    orgLabel: 'Internal',
    title: 'RA Knowledge Base (ra-project)',
    type: 'Internal',
    region: 'KR',
    docClass: DocClass.internal_sop,
  },
  {
    repoPath: MD_PROCESS_PATH,
    orgLabel: 'Internal',
    title: 'MD Process SOPs (MD-process)',
    type: 'Internal',
    region: 'KR',
    docClass: DocClass.internal_sop,
  },
];

// Skip directories that are not useful for RA queries
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'scripts',
  'issue-drafts',
  '99_원본자료_업로드저장소',
]);

/** Strip null bytes and control characters that postgres rejects. */
function sanitize(s: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally strips postgres-rejected control bytes
  return s.replace(/\x00/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (stat.isFile() && extname(entry).toLowerCase() === '.md') {
      files.push(full);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const key = process.env.OPENAI_API_KEY ?? '';
  const hasRealKey = key.startsWith('sk-');
  if (!hasRealKey) {
    logger.info('FTS-only mode: embeddings will be NULL (no valid OPENAI_API_KEY)');
  }

  const chunker = makeGenericChunker(DocClass.internal_sop);
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const src of LOCAL_SOURCES) {
    // Upsert source row
    const existing = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.title, src.title))
      .limit(1);

    let sourceId: string;
    if (existing.length > 0 && existing[0]) {
      sourceId = existing[0].id;
      logger.info(`Source exists, reusing: ${src.title} (${sourceId.substring(0, 8)})`);
    } else {
      const inserted = await db
        .insert(sources)
        .values({
          orgLabel: src.orgLabel,
          title: src.title,
          year: new Date().getFullYear(),
          type: src.type,
          region: src.region,
          url: src.repoPath,
          embedding: null as unknown as number[],
        })
        .returning({ id: sources.id });
      const row = inserted[0];
      if (!row) throw new Error(`Insert failed for ${src.title}`);
      sourceId = row.id;
      logger.info(`Created source: ${src.title} (${sourceId.substring(0, 8)})`);
    }

    // Collect all .md files
    const files = collectMarkdownFiles(src.repoPath);
    logger.info(`Found ${files.length} markdown files in ${src.repoPath}`);

    for (const filePath of files) {
      const relPath = relative(src.repoPath, filePath);
      const fileBasename = basename(filePath, '.md');

      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (e) {
        logger.warn(`Could not read ${filePath}: ${e}`);
        continue;
      }

      if (!content.trim()) continue;

      // Chunk the file
      const chunks = chunker(content, {});
      if (chunks.length === 0) continue;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;
        // Anchor: relative path + chunk index (stable, unique per file)
        const anchor = `${relPath}#${i}`;
        const heading =
          chunk.metadata.sectionPath !== 'Document' ? chunk.metadata.sectionPath : fileBasename;

        try {
          // Omit embedding — nullable column defaults to NULL in DB (FTS-only mode)
          await db.insert(sourceSections).values({
            sourceId,
            anchor: sanitize(anchor).substring(0, 500),
            heading: sanitize(heading).substring(0, 500),
            text: sanitize(chunk.text).substring(0, 8000),
          } as typeof sourceSections.$inferInsert);
          totalInserted++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const cause = (err as { cause?: { code?: string; constraint_name?: string } })?.cause;
          const isUnique =
            msg.includes('source_sections_source_anchor_idx') ||
            msg.includes('unique constraint') ||
            msg.includes('duplicate key') ||
            cause?.code === '23505' ||
            cause?.constraint_name === 'source_sections_source_anchor_idx';
          if (isUnique) {
            totalSkipped++;
            continue;
          }
          throw err;
        }
      }
    }

    logger.info(`Done with ${src.title}`);
  }

  logger.info(`Seed complete: ${totalInserted} inserted, ${totalSkipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('seed-local-docs failed:', err);
  process.exit(1);
});
