// @MX:ANCHOR [AUTO] Change detector — content hash comparison for delta-sync.
// @MX:REASON fan_in >= 3: called by crawler completion handler, delta-sync
// orchestrator, and gap-replay trigger. Core entry point for incremental updates.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-001, REQ-DELTA-003)

import { createHash } from 'node:crypto';

/**
 * Compute a deterministic SHA-256 hash of (content, sourceUrl).
 * URL is included to prevent cross-source hash collisions (REQ-DELTA-003).
 */
export function computeContentHash(rawContent: string, sourceUrl: string): string {
  return createHash('sha256').update(`${sourceUrl}\n${rawContent}`).digest('hex');
}

export interface ChangeDetectionInput {
  crawlerName: string;
  sourceUrl: string;
  rawContent: string;
  /** Previously stored hash for this source URL, or null if first sighting. */
  existingHash: string | null;
}

export type ChangeStatus = 'new' | 'changed' | 'unchanged';

export interface ChangeDetectionResult {
  crawlerName: string;
  sourceUrl: string;
  status: ChangeStatus;
  contentHash: string;
}

/**
 * Detect whether a crawled document is new, changed, or unchanged.
 * Reuses the checksum dedup pattern from runCrawler's external_id strategy
 * (REQ-DELTA-001). Full re-index is prohibited — only changed documents flow
 * downstream.
 */
export function detectChanges(input: ChangeDetectionInput): ChangeDetectionResult {
  const contentHash = computeContentHash(input.rawContent, input.sourceUrl);

  let status: ChangeStatus;
  if (input.existingHash === null) {
    status = 'new';
  } else if (input.existingHash === contentHash) {
    status = 'unchanged';
  } else {
    status = 'changed';
  }

  return {
    crawlerName: input.crawlerName,
    sourceUrl: input.sourceUrl,
    status,
    contentHash,
  };
}
