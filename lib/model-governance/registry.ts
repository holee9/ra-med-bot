// @MX:NOTE [AUTO] registry.ts — immutable prompt/template version store (REQ-MODELGOV-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-001)
// @MX:REASON Insert-only. content_hash deduplicates identical content. Never
//           UPDATE an existing row — new content always becomes a new version.

import { createHash } from 'node:crypto';
import { db } from '@/lib/kernel/db/client';
import { promptRegistry } from '@/lib/kernel/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { RegisteredPrompt } from './types';

/**
 * SHA-256 content hash for deduplication. Hex digest, lowercase.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * REQ-MODELGOV-001: register an immutable prompt/template version.
 *
 * - If identical content (same kind + content_hash) already exists for this org,
 *   return the existing row (idempotent — no duplicate version created).
 * - Otherwise compute the next version number (max + 1 for this org+kind) and
 *   insert. The row is insert-only: there is no update path.
 */
export async function registerPrompt(params: {
  orgId: string;
  kind: 'prompt' | 'template';
  content: string;
  createdBy: string | null;
}): Promise<RegisteredPrompt> {
  const contentHash = computeContentHash(params.content);

  // Idempotent dedup: if the same content already exists, return it.
  const [existing] = await db
    .select({
      id: promptRegistry.id,
      kind: promptRegistry.kind,
      contentHash: promptRegistry.contentHash,
      version: promptRegistry.version,
      createdAt: promptRegistry.createdAt,
    })
    .from(promptRegistry)
    .where(
      and(
        eq(promptRegistry.orgId, params.orgId),
        eq(promptRegistry.kind, params.kind),
        eq(promptRegistry.contentHash, contentHash),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Next version = max version for this org+kind + 1 (or 1 if none).
  const [latest] = await db
    .select({ version: promptRegistry.version })
    .from(promptRegistry)
    .where(and(eq(promptRegistry.orgId, params.orgId), eq(promptRegistry.kind, params.kind)))
    .orderBy(desc(promptRegistry.version))
    .limit(1);
  const nextVersion = (latest?.version ?? 0) + 1;

  const [row] = await db
    .insert(promptRegistry)
    .values({
      orgId: params.orgId,
      kind: params.kind,
      contentHash,
      content: params.content,
      version: nextVersion,
      createdBy: params.createdBy,
    })
    .returning({
      id: promptRegistry.id,
      kind: promptRegistry.kind,
      contentHash: promptRegistry.contentHash,
      version: promptRegistry.version,
      createdAt: promptRegistry.createdAt,
    });

  if (!row) throw new Error('prompt_registry insert returned no rows');
  return row;
}

/**
 * List all prompt/template versions for an org (newest first).
 */
export async function listPrompts(orgId: string, kind?: 'prompt' | 'template') {
  const where = kind
    ? and(eq(promptRegistry.orgId, orgId), eq(promptRegistry.kind, kind))
    : eq(promptRegistry.orgId, orgId);
  return db
    .select({
      id: promptRegistry.id,
      kind: promptRegistry.kind,
      contentHash: promptRegistry.contentHash,
      version: promptRegistry.version,
      createdAt: promptRegistry.createdAt,
      createdBy: promptRegistry.createdBy,
    })
    .from(promptRegistry)
    .where(where)
    .orderBy(desc(promptRegistry.version));
}
