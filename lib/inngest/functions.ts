// @MX:NOTE [AUTO] Central Inngest function registry. The serve endpoint imports
// this array so every registered function is exposed in one place.
// @MX:SPEC SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001 / SPEC-REGULA-KNOWLEDGE-GAP-001 / SPEC-REGULA-STANDARDS-001 / SPEC-REGULA-KNOWLEDGE-PROMO-001

import { knowledgeGapDailyDigestFn } from './digest/knowledge-gap-daily-digest';
import { weeklyDigestFn } from './digest/weekly-digest';
import { uploadProcessedFn } from './docingest/upload-processed';
import { messagesEmbeddingBackfillJob } from './knowledge-promo/messages-embedding-backfill';
import { knowledgeSourcesOrphanCleanupFn } from './knowledge-sources/orphan-cleanup';
import { standardsRevisionDailyFn } from './standards/standards-revision-daily';

/**
 * All Inngest functions served by app/api/inngest/route.ts.
 * Add new functions here (single source of truth for registration).
 */
export const functions = [
  weeklyDigestFn,
  knowledgeGapDailyDigestFn,
  uploadProcessedFn,
  standardsRevisionDailyFn,
  messagesEmbeddingBackfillJob, // Issue 275 — messages embedding backfill
  knowledgeSourcesOrphanCleanupFn, // Issue 313 — daily orphan sources cleanup
];
